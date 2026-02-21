/**
 * @name FakeDeafen
 * @author arg0NNY (updated by ChatGPT)
 * @version 1.1.0
 * @description Listen/talk in voice while self-deafened. Assumes BDFDB is installed.
 */

module.exports = (() => {

    const config = {
        info: {
            name: "FakeDeafen",
            authors: [{ name: "arg0NNY" }],
            version: "1.1.0",
            description: "Listen/talk in voice while self-deafened.",
            github: "https://github.com/arg0NNY/DiscordPlugin-FakeDeafen",
            github_raw: "https://raw.githubusercontent.com/arg0NNY/DiscordPlugin-FakeDeafen/main/FakeDeafen.plugin.js"
        },
        defaultConfig: [
            { type: "switch", id: "accountButton", name: "Enable toggle button", value: true },
            { type: "switch", id: "sounds", name: "Enable sounds", value: true }
        ]
    };

    const { Plugin, Api } = BDFDB;
    const { Toasts, DiscordModules, PatchUtils } = Api;
    const VoiceInfo = DiscordModules.VoiceInfo;
    const ChannelActions = DiscordModules.ChannelActions;
    const SelectedChannelStore = DiscordModules.SelectedChannelStore;

    const Sounds = { ENABLE: "ptt_start", DISABLE: "ptt_stop" };

    return class FakeDeafen extends Plugin {

        onStart() {
            this.fixated = false;
            this.patchVoice();
            this.injectButton();
        }

        patchVoice() {
            const preventStop = () => {
                if (!this.fixated) return;
                this.toggleFixate(false);
                Toasts.warning("FakeDeafen disabled (left channel)");
            };

            PatchUtils.before(ChannelActions, "disconnect", () => preventStop());
            PatchUtils.before(ChannelActions, "selectVoiceChannel", () => preventStop());
        }

        injectButton() {
            const VoicePanel = WebpackModules.find(m => m?.toString?.().includes("voice") && m.render && m.render.toString().includes("SELF_MUTE"));
            if (!VoicePanel) return;

            PatchUtils.after(VoicePanel.prototype, "render", (_, args, res) => {
                if (!this.settings.accountButton) return;
                const btn = BDFDB.React.createElement("button", {
                    className: "btn-1b6Oz0",
                    style: { marginRight: "6px" },
                    onClick: () => this.toggleFixate()
                }, this.fixated ? "Disable Fake" : "Enable Fake");
                res.props.children.unshift(btn);
            });
        }

        toggleFixate(status = null) {

            if ((!this.fixated || status === true) && !VoiceInfo.isMute() && !VoiceInfo.isDeaf())
                return Toasts.error("Mute or Deaf yourself first.");

            if (!SelectedChannelStore.getVoiceChannelId())
                return Toasts.error("Connect to a voice channel first.");

            this.fixated = status === null ? !this.fixated : status;

            if (this.settings.sounds) {
                BDFDB.LibraryModules.SoundUtils.playSound(this.fixated ? Sounds.ENABLE : Sounds.DISABLE);
            }

            if (this.fixated) this.hookWebsocket();
            else this.restoreWebsocket();

            Toasts.info(`FakeDeafen ${this.fixated ? "enabled" : "disabled"}`);
        }

        hookWebsocket() {
            const decoder = new TextDecoder("utf-8");
            WebSocket.prototype._realSend = WebSocket.prototype.send;
            WebSocket.prototype.send = function (data) {
                if (data instanceof ArrayBuffer) {
                    const txt = decoder.decode(data);
                    if (txt.includes("self_deaf") || txt.includes("self_mute")) {
                        const fixed = txt.replace('"self_mute":false', '"self_mute":true');
                        data = BDFDB.Buffer.from(fixed, "utf-8");
                    }
                }
                WebSocket.prototype._realSend.apply(this, [data]);
            };
        }

        restoreWebsocket() {
            if (WebSocket.prototype._realSend) {
                WebSocket.prototype.send = WebSocket.prototype._realSend;
            }
        }

        onStop() {
            this.restoreWebsocket();
            BDFDB.PatchUtils.unpatchAll();
        }

    };

})();

/**
 * @name FakeDeafen
 * @author arg0NNY (updated)
 * @version 1.3.0
 * @description Listen/talk in voice while self-deafened. Uses BDFDB; assumes it’s installed.
 */

module.exports = (() => {

    const config = {
        info: {
            name: "FakeDeafen",
            authors: [{ name: "arg0NNY" }],
            version: "1.3.0",
            description: "Listen/talk in voice while self-deafened with toggle icon.",
            github: "https://github.com/arg0NNY/DiscordPlugin-FakeDeafen",
            github_raw: "https://raw.githubusercontent.com/arg0NNY/DiscordPlugin-FakeDeafen/main/FakeDeafen.plugin.js"
        },
        defaultConfig: [
            { type: "switch", id: "accountButton", name: "Enable toggle button", value: true },
            { type: "switch", id: "sounds", name: "Enable sounds", value: true }
        ]
    };

    return class FakeDeafen extends BDFDB.DiscordPlugins.Plugin {

        onStart() {
            this.fixated = false;
            this.patchVoice();
            this.injectToggleButton();
        }

        patchVoice() {
            const preventStop = () => {
                if (!this.fixated) return;
                this.toggleFixate(false);
                BDFDB.DiscordModules.Toasts.warning("FakeDeafen disabled (left channel)");
            };

            BDFDB.PatchUtils.before(BDFDB.DiscordModules.ChannelActions, "disconnect", () => preventStop());
            BDFDB.PatchUtils.before(BDFDB.DiscordModules.ChannelActions, "selectVoiceChannel", () => preventStop());
        }

        injectToggleButton() {
            const VoicePanel = BDFDB.WebpackModules.find(
                m => m?.toString?.().includes("self_mute") && m?.default?.toString?.().includes("Voice")
            );
            if (!VoicePanel) return;

            BDFDB.PatchUtils.after(VoicePanel.prototype, "render", (_, args, res) => {
                if (!this.settings.accountButton) return;

                const children = res.props.children;
                if (!children?.props?.children) return;

                const btn = BDFDB.React.createElement("button", {
                    className: "btn-1b6Oz0",
                    style: { marginRight: "6px" },
                    title: this.fixated ? "Disable Fake Mute/Deafen" : "Enable Fake Mute/Deafen",
                    onClick: () => this.toggleFixate()
                },
                    BDFDB.React.createElement("svg", {
                        width: 20,
                        height: 20,
                        viewBox: "0 0 20 20"
                    },
                        BDFDB.React.createElement("path", {
                            fill: "currentColor",
                            d: this.fixated
                                ? "M5.312 4.566C4.19 5.685-.715 12.681 3.523 16.918c4.236 4.238 11.23-.668 12.354-1.789c1.121-1.119-.335-4.395-3.252-7.312c-2.919-2.919-6.191-4.376-7.313-3.251zm9.264 9.59c-.332.328-2.895-.457-5.364-2.928c-2.467-2.469-3.256-5.033-2.924-5.363c.328-.332 2.894.457 5.36 2.926c2.471 2.467 3.258 5.033 2.928 5.365zm.858-8.174l1.904-1.906a.999.999 0 1 0-1.414-1.414L14.02 4.568a.999.999 0 1 0 1.414 1.414zM11.124 3.8a1 1 0 0 0 1.36-.388l1.087-1.926a1 1 0 0 0-1.748-.972L10.736 2.44a1 1 0 0 0 .388 1.36zm8.748 3.016a.999.999 0 0 0-1.36-.388l-1.94 1.061a1 1 0 1 0 .972 1.748l1.94-1.061a1 1 0 0 0 .388-1.36z"
                                : "M14.201 9.194c1.389 1.883 1.818 3.517 1.559 3.777c-.26.258-1.893-.17-3.778-1.559l-5.526 5.527c4.186 1.838 9.627-2.018 10.605-2.996c.925-.922.097-3.309-1.856-5.754l-1.004 1.005zM8.667 7.941c-1.099-1.658-1.431-3.023-1.194-3.26c.233-.234 1.6.096 3.257 1.197l1.023-1.025C9.489 3.179 7.358 2.519 6.496 3.384c-.928.926-4.448 5.877-3.231 9.957l5.402-5.4zm9.854-6.463a.999.999 0 0 0-1.414 0L1.478 17.108a.999.999 0 1 0 1.414 1.414l15.629-15.63a.999.999 0 0 0 0-1.414z"
                        })
                    )
                );

                children.props.children.unshift(btn);
            });
        }

        toggleFixate(status = null) {

            if ((!this.fixated || status === true) && !BDFDB.DiscordModules.VoiceInfo.isMute() && !BDFDB.DiscordModules.VoiceInfo.isDeaf())
                return BDFDB.DiscordModules.Toasts.error("Mute or Deaf yourself first.");

            if (!BDFDB.DiscordModules.SelectedChannelStore.getVoiceChannelId())
                return BDFDB.DiscordModules.Toasts.error("Connect to a voice channel first.");

            this.fixated = status === null ? !this.fixated : status;

            if (this.settings.sounds) {
                BDFDB.LibraryModules.SoundUtils.playSound(this.fixated ? "ptt_start" : "ptt_stop");
            }

            if (this.fixated) this.hookWebsocket();
            else this.restoreWebsocket();

            BDFDB.DiscordModules.Toasts.info(`FakeDeafen ${this.fixated ? "enabled" : "disabled"}`);
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
            if (WebSocket.prototype._realSend) WebSocket.prototype.send = WebSocket.prototype._realSend;
        }

        onStop() {
            this.restoreWebsocket();
            BDFDB.PatchUtils.unpatchAll();
        }

    };

})();

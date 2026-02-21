/**
 * @name FakeDeafen
 * @author arg0NNY
 * @version 1.6.0
 * @description Listen or talk in voice while self-deafened. Toggle button appears next to Mute/Deafen.
 * @source https://github.com/arg0NNY/DiscordPlugin-FakeDeafen
 */

module.exports = (_ => {
	const changeLog = {
		"fixed": ["Toggle button now reliably shows next to Mute/Deafen using BDFDB"]
	};

	return !window.BDFDB_Global || (!window.BDFDB_Global.loaded && !window.BDFDB_Global.started) ? class {
		constructor(meta){for(let key in meta)this[key]=meta[key];}
		getName(){return this.name;}
		getAuthor(){return this.author;}
		getVersion(){return this.version;}
		getDescription(){return `The Library Plugin needed for ${this.name} is missing.`;}
	} : (([Plugin, BDFDB]) => {

		let toggleButton;

		return class FakeDeafen extends Plugin {
			onStart(){
				this.fixated = false;
				this.patchVoiceActions();
				this.injectToggleButton();
			}

			patchVoiceActions(){
				const preventStop = () => {
					if(!this.fixated) return;
					this.toggleFixate(false);
					BDFDB.DiscordModules.Toasts.warning("FakeDeafen disabled (left channel)");
				};
				BDFDB.PatchUtils.before(BDFDB.DiscordModules.ChannelActions, "disconnect", () => preventStop());
				BDFDB.PatchUtils.before(BDFDB.DiscordModules.ChannelActions, "selectVoiceChannel", () => preventStop());
			}

			injectToggleButton(){
				const VoicePanel = BDFDB.WebpackModules.find(m => m?.toString?.().includes("self_mute") && m?.default?.toString?.includes("Voice"));
				if(!VoicePanel) return;

				BDFDB.PatchUtils.after(VoicePanel.prototype, "render", (_, args, res)=>{
					const channelId = BDFDB.DiscordModules.SelectedChannelStore.getVoiceChannelId();
					if(!channelId) return; // only show in voice channels

					// find the container holding Mute/Deafen buttons
					const buttonRow = BDFDB.ReactUtils.findChild(res, {
						props: ["children"],
						matcher: (c) => c?.props?.children?.some?.(x=>x?.type?.displayName?.includes("MuteButton") || x?.type?.displayName?.includes("DeafenButton"))
					}, {walk:true});

					if(!buttonRow) return;

					// remove previous button if rerendered
					buttonRow.props.children = buttonRow.props.children.filter(c=>c?.key!=="fakeDeafenToggle");

					// create the toggle button
					const toggleBtn = BDFDB.React.createElement("button", {
						key: "fakeDeafenToggle",
						className: "btn-1b6Oz0",
						style: {marginLeft:"6px"},
						title: this.fixated ? "Disable Fake Mute/Deafen" : "Enable Fake Mute/Deafen",
						onClick: ()=>this.toggleFixate()
					}, BDFDB.React.createElement("svg",{width:20,height:20,viewBox:"0 0 20 20"},
						BDFDB.React.createElement("path",{fill:"currentColor", d:this.fixated
							? "M5.312 4.566C4.19 5.685-.715 12.681 3.523 16.918c4.236 4.238 11.23-.668 12.354-1.789c1.121-1.119-.335-4.395-3.252-7.312c-2.919-2.919-6.191-4.376-7.313-3.251zm9.264 9.59c-.332.328-2.895-.457-5.364-2.928c-2.467-2.469-3.256-5.033-2.924-5.363c.328-.332 2.894.457 5.36 2.926c2.471 2.467 3.258 5.033 2.928 5.365zm.858-8.174l1.904-1.906a.999.999 0 1 0-1.414-1.414L14.02 4.568a.999.999 0 1 0 1.414 1.414zM11.124 3.8a1 1 0 0 0 1.36-.388l1.087-1.926a1 1 0 0 0-1.748-.972L10.736 2.44a1 1 0 0 0 .388 1.36zm8.748 3.016a.999.999 0 0 0-1.36-.388l-1.94 1.061a1 1 0 1 0 .972 1.748l1.94-1.061a1 1 0 0 0 .388-1.36z"
							: "M14.201 9.194c1.389 1.883 1.818 3.517 1.559 3.777c-.26.258-1.893-.17-3.778-1.559l-5.526 5.527c4.186 1.838 9.627-2.018 10.605-2.996c.925-.922.097-3.309-1.856-5.754l-1.004 1.005zM8.667 7.941c-1.099-1.658-1.431-3.023-1.194-3.26c.233-.234 1.6.096 3.257 1.197l1.023-1.025C9.489 3.179 7.358 2.519 6.496 3.384c-.928.926-4.448 5.877-3.231 9.957l5.402-5.4zm9.854-6.463a.999.999 0 0 0-1.414 0L1.478 17.108a.999.999 0 1 0 1.414 1.414l15.629-15.63a.999.999 0 0 0 0-1.414z"
						})
					));

					buttonRow.props.children.push(toggleBtn);
				});
			}

			toggleFixate(status=null){
				const VoiceInfo = BDFDB.DiscordModules.VoiceInfo;
				const SelectedChannelStore = BDFDB.DiscordModules.SelectedChannelStore;

				if((!this.fixated || status===true) && !VoiceInfo.isMute() && !VoiceInfo.isDeaf())
					return BDFDB.DiscordModules.Toasts.error("Mute or Deaf yourself first.");
				if(!SelectedChannelStore.getVoiceChannelId())
					return BDFDB.DiscordModules.Toasts.error("Connect to a voice channel first.");

				this.fixated = status===null ? !this.fixated : status;

				if(this.settings?.sounds)
					BDFDB.LibraryModules.SoundUtils.playSound(this.fixated?"ptt_start":"ptt_stop");

				if(this.fixated) this.hookWebsocket();
				else this.restoreWebsocket();

				BDFDB.DiscordModules.Toasts.info(`FakeDeafen ${this.fixated?"enabled":"disabled"}`);
			}

			hookWebsocket(){
				const decoder = new TextDecoder("utf-8");
				WebSocket.prototype._realSend = WebSocket.prototype.send;
				WebSocket.prototype.send = function(data){
					if(data instanceof ArrayBuffer){
						const txt = decoder.decode(data);
						if(txt.includes("self_deaf")||txt.includes("self_mute")){
							const fixed = txt.replace('"self_mute":false','"self_mute":true');
							data = BDFDB.Buffer.from(fixed,"utf-8");
						}
					}
					WebSocket.prototype._realSend.apply(this,[data]);
				};
			}

			restoreWebsocket(){
				if(WebSocket.prototype._realSend) WebSocket.prototype.send = WebSocket.prototype._realSend;
			}

			onStop(){
				this.restoreWebsocket();
				BDFDB.PatchUtils.unpatchAll();
			}
		};
	})(window.BDFDB_Global.PluginUtils.buildPlugin(changeLog));
})();

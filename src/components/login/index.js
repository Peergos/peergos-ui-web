var isDemo = window.location.hostname == "demo.peergos.net";
var isLocalhost = window.location.hostname == "localhost";
module.exports = {
    template: require('login.html'),
    data: function() {
        return {
	    network: null,
            username: "",
            passwordFieldType: "password",
            password: [],
	    token: "",
            demo: isDemo,
            isFirefox: false,
            isSafari: false,
            showSpinner: false,
            showError:false,
            errorTitle:'',
            errorBody:'',
            spinnerMessage:'',
            isSecretLink: false
        };
    },
    props: {},
    created: function() {
	this.updateNetwork();
    },
    watch: {
	network: function(newNetwork) {
	    this.isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
            this.isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || safari.pushNotification);
            var that = this;
            const href = window.location.href;
            var fragment = window.location.hash.substring(1);
	    var props = {};
	    try {
		props = fragmentToProps(fragment);
	    } catch (e) {
		if (fragment.length > 0) {
		    // support legacy secret links
		    props.secretLink = true;

		    var query = fragment.indexOf("?");
		    if (query > 0) {
			if (fragment.indexOf("download=true") > 0)
			    props.download = true;
			if (fragment.indexOf("open=true") > 0)
			    props.open = true;
			fragment = fragment.substring(0, query);
		    }
		    props.link = fragment;
		}
	    }
            if (href.includes("?signup=true")) {
		if (href.includes("token=")) {
		    var urlParams = new URLSearchParams(window.location.search);
		    this.token = urlParams.get("token");
		}
		this.showSignup();
            } else if (props.secretLink) {
		// this is a secret link
		this.isSecretLink = true;
		console.log("Navigating to secret link...");
		Vue.nextTick(function() {
                    that.gotoSecretLink(props);
		});
            } else
		Vue.nextTick(function() {
                    document.getElementById("username").focus();
		});
	    this.checkIfDomainNeedsUnblocking();
	}
    },
    methods: {
	updateNetwork: function() {
	    var that = this;
	    peergos.shared.NetworkAccess.buildJS("QmVdFZgHnEgcedCS2G2ZNiEN59LuVrnRm7z3yXtEBv2XiF", !isLocalhost)
                .thenApply(function(network){
		    that.network = network;
		});
	},

	checkIfDomainNeedsUnblocking: function() {
	    if (this.network == null)
		return;
	    var that = this;
	    this.network.otherDomain().thenApply(function(domainOpt) {
		if (domainOpt.isPresent()) {
		    var req = new XMLHttpRequest();
		    var url = domainOpt.get() + "notablock";
		    req.open('GET', url);
		    req.responseType = 'arraybuffer';
		    req.onload = function() {
			console.log("S3 test returned: " + req.status)
		    };
    
		    req.onerror = function(e) {
			that.errorTitle = "Unblock domain";
			that.errorBody = "Please unblock the following domain for Peergos to function correctly: " + domainOpt.get();
			that.showError = true;
		    };
		    
		    req.send();
		}
	    });
	},
	
        togglePassword: function() {
            this.passwordFieldType = this.passwordFieldType == "text" ? "password" : "text";
        },

        lowercaseUsername: function() {
            return this.username.toLocaleLowerCase();
        },

        displayDemoWarning: function() {
	    if (this.demo == true) {
                if(this.isSecretLink == true) {
                    return false;
                }
                return true;
            } else {
                return false;
            }
        },
        gotoSecretLink: function(props) {
            var that = this;
            peergos.shared.NetworkAccess.buildJS("QmVdFZgHnEgcedCS2G2ZNiEN59LuVrnRm7z3yXtEBv2XiF", !isLocalhost)
                .thenApply(function(network){
                    peergos.shared.user.UserContext.fromSecretLink(props.link, network, that.crypto).thenApply(function(context) {
                        that.$emit('filesystem', 
				   {
                                       context: context,
                                       download: props.download,
                                       open: props.open,
				       initPath: props.path
				   }
				  );
                    }).exceptionally(function(throwable) {
                        that.errorTitle = 'Secret link not found!'
                        that.errorBody = 'Url copy/paste error?'
                        that.showSpinner = false;
                        that.showError = true;
                    });
                });
        },

        login : function() {
            const creationStart = Date.now();
            const that = this;
            this.showSpinner = true;
            return peergos.shared.user.UserContext.signIn(
                    that.lowercaseUsername(), that.password, that.network, that.crypto, {"accept" : x => that.spinnerMessage = x}).thenApply(function(context) {
                that.$emit("filesystem", {context: context})
                console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
                that.showSpinner = false;
            }).exceptionally(function(throwable) {
                        console.log('Error logging in: '+throwable);
                        that.errorTitle = 'Error logging-in'
                        that.errorBody = throwable.detailMessage;
                        that.showSpinner = false;
                        that.showError = true;
                    });
        },

        showSignup : function() {
            var that = this;
            peergos.shared.NetworkAccess.buildJS("QmVdFZgHnEgcedCS2G2ZNiEN59LuVrnRm7z3yXtEBv2XiF", !isLocalhost)
                .thenApply(function(network) {
                    that.$emit("signup", {
                        username:that.lowercaseUsername(),
                        password1:that.password,
                        crypto: that.crypto,
                        network: network,
			token: that.token
                    })
                });
        }
    },
    computed: {
        crypto: function() {
            return peergos.shared.Crypto.initJS();
        }
    }
};

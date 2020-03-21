var Admin           = require('./components/admin');
var App             = require('./components/app');
var CodeEditor      = require('./components/code-editor');
var Downloader      = require('./components/downloader');
var Error           = require('./components/error');
var Feedback        = require('./components/feedback');
var Filesystem      = require('./components/filesystem');
var Fingerprint     = require('./components/fingerprint');
var Gallery         = require('./components/gallery');
var Hex             = require('./components/viewers/hex');
var Login           = require('./components/login');
var Message         = require('./components/message');
var Modal           = require('./components/modal');
var Password        = require('./components/password');
var VideoCapture    = require('./components/video-capture');
var PasswordUtil    = require('./components/passwordutil');
var Pdf             = require('./components/pdf');
var ProgressBar     = require('./components/progressbar');
var Prompt          = require('./components/prompt');
var Share           = require('./components/share');
var SharedWithModal = require('./components/shared-with-modal');
var Signup          = require('./components/signup');
var Social          = require('./components/social');
var Space           = require('./components/space');
var Spinner         = require('./components/spinner');
var Text            = require('./components/viewers/text-viewer');
var Tour            = require('./components/tour');
var Warning         = require('./components/warning');
var Replace         = require('./components/replace');

// Loading components
Vue.component('admin', Vue.extend(Admin));
Vue.component('app', Vue.extend(App));
Vue.component('code-editor', Vue.extend(Downloader).extend(CodeEditor));
Vue.component('error', Vue.extend(Error));
Vue.component('feedback', Vue.extend(Feedback));
Vue.component('filesystem', Vue.extend(Downloader).extend(Filesystem));
Vue.component('fingerprint', Vue.extend(Fingerprint));
Vue.component('gallery', Vue.extend(Downloader).extend(Gallery));
Vue.component('hex', Vue.extend(Downloader).extend(Hex));
Vue.component('login', Vue.extend(Login));
Vue.component('message', Vue.extend(Message));
Vue.component('modal', Vue.extend(Modal));
Vue.component('password', Vue.extend(PasswordUtil).extend(Password));
Vue.component('video-capture', Vue.extend(VideoCapture));
Vue.component('pdf', Vue.extend(Downloader).extend(Pdf));
Vue.component('progressbar', Vue.extend(ProgressBar));
Vue.component('prompt', Vue.extend(Prompt));
Vue.component('signup', Vue.extend(PasswordUtil).extend(Signup));
Vue.component('share', Vue.extend(Share));
Vue.component('shared-with-modal', Vue.extend(SharedWithModal));
Vue.component('social', Vue.extend(Social));
Vue.component('spinner', Vue.extend(Spinner));
Vue.component('space', Vue.extend(Space));
Vue.component('text-viewer', Vue.extend(Downloader).extend(Text));
Vue.component('tour', Vue.extend(Tour));
Vue.component('warning', Vue.extend(Warning));
Vue.component('replace', Vue.extend(Replace));

// Initializing Vue after GWT has finished
setTimeout(function() {
    var vueRoot = new Vue({
        el: '#app',
        data: {
            currentView: 'app',
        }
    });
}, 500);

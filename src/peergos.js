var Account         = require('./components/account');
var Admin           = require('./components/admin');
var App             = require('./components/app');
var AppGrid         = require('./components/appgrid');
var Calendar        = require('./components/calendar');
var Choice         = require('./components/choice');
var CodeEditor      = require('./components/code-editor');
var Downloader      = require('./components/downloader');
var Email           = require('./components/email');
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
var ProfileEdit     = require('./components/profile/edit-profile');
var ProfileView     = require('./components/profile/view-profile');
var PasswordUtil    = require('./components/passwordutil');
var Payments        = require('./components/payment');
var Pdf             = require('./components/pdf');
var ProgressBar     = require('./components/progressbar');
var MessageBar     = require('./components/messagebar');
var Prompt          = require('./components/prompt');
var Replace         = require('./components/replace');
var Search          = require('./components/search');
var SelectCreate    = require('./components/select-create');
var Share           = require('./components/share');
var Signup          = require('./components/signup');
var Social          = require('./components/social');
var SocialPost      = require('./components/social-post');
var Space           = require('./components/space');
var Spinner         = require('./components/spinner');
var Text            = require('./components/viewers/text-viewer');
var Timeline        = require('./components/timeline');
var Todo            = require('./components/todo');
var Tour            = require('./components/tour');
var Confirm         = require('./components/confirm');
var Warning         = require('./components/warning');

// Loading components
Vue.component('account', Vue.extend(Account));
Vue.component('admin', Vue.extend(Admin));
Vue.component('app', Vue.extend(App));
Vue.component('appgrid', Vue.extend(AppGrid));
Vue.component('calendar', Vue.extend(Calendar));
Vue.component('choice', Vue.extend(Choice));
Vue.component('code-editor', Vue.extend(Downloader).extend(CodeEditor));
Vue.component('email', Vue.extend(Email));
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
Vue.component('profile-edit', Vue.extend(ProfileEdit));
Vue.component('profile-view', Vue.extend(ProfileView));
Vue.component('payment', Vue.extend(Payments));
Vue.component('pdf', Vue.extend(Downloader).extend(Pdf));
Vue.component('progressbar', Vue.extend(ProgressBar));
Vue.component('messagebar', Vue.extend(MessageBar));
Vue.component('prompt', Vue.extend(Prompt));
Vue.component('replace', Vue.extend(Replace));
Vue.component('search', Vue.extend(Search));
Vue.component('select-create', Vue.extend(SelectCreate));
Vue.component('signup', Vue.extend(PasswordUtil).extend(Signup));
Vue.component('share', Vue.extend(Share));
Vue.component('social', Vue.extend(Social));
Vue.component('social-post', Vue.extend(SocialPost));
Vue.component('spinner', Vue.extend(Spinner));
Vue.component('space', Vue.extend(Space));
Vue.component('text-viewer', Vue.extend(Downloader).extend(Text));
Vue.component('timeline', Vue.extend(Timeline));
Vue.component('todo-board', Vue.extend(Downloader).extend(Todo));
Vue.component('tour', Vue.extend(Tour));
Vue.component('confirm', Vue.extend(Confirm));
Vue.component('warning', Vue.extend(Warning));

Vue.directive('focus', {
  inserted: function (el) {
    // Focus the element
    el.focus()
  }
})

// Initializing Vue after GWT has finished
setTimeout(function() {
    var vueRoot = new Vue({
        el: '#app',
        data: {
            currentView: 'app',
        },
        render: function() {
            with(this){return _c('div',{staticClass:"fillspace",attrs:{"id":"app"}},[_c(currentView,{tag:"component"})],1)}
        }
    });
}, 500);

console.log("█╗█╗█╗█╗   ██████╗ ███████╗███████╗██████╗  ██████╗  ██████╗ ███████╗   █╗█╗█╗█╗\n" +
            " █████╔╝   ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝ ██╔═══██╗██╔════╝    █████╔╝\n" +
            " ██ ██║    ██████╔╝█████╗  █████╗  ██████╔╝██║  ███╗██║   ██║███████╗    ██ ██║\n" +
            " █████║    ██╔═══╝ ██╔══╝  ██╔══╝  ██╔══██╗██║   ██║██║   ██║╚════██║    █████║\n" +
            "███████╗   ██║     ███████╗███████╗██║  ██║╚██████╔╝╚██████╔╝███████║   ███████╗\n" +
            "╚══════╝   ╚═╝     ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝   ╚══════╝");

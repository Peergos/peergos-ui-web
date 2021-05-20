module.exports = {
    template: require('appgrid.html'),
    data: function() {
        return {};
    },
    props: ["context", "social", "canUpgrade", "isEmailAvailable"],
    created: function() {
    },
    methods: {
        showTour: function() {
            this.$emit("tour");
        },
        showOurFiles: function() {
            this.$emit("files", {path:[this.context.username]});
	},
        showFriendsFiles: function() {
            this.$emit("files", {path:[]});
        },
        showFeed: function() {
            this.$emit("news-feed");
        },
        showCalendar: function() {
            this.$emit("calendar");
        },
        showTodoBoard: function() {
            this.$emit("todo");
        },
        showSearch: function() {
            this.$emit("search");
        },
        showSocial: function() {
            this.$emit("social");
        },
        showProfile: function() {
            this.$emit("profile");
        },
        showUpgrade: function() {
            this.$emit("upgrade");
        },
        showEmail: function() {
            this.$emit("email");
        }
    },
};

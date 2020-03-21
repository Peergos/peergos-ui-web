module.exports = {
    template: require('video-capture.html'),
    data: function() {
        return {
            buttonLabel: "start capture",
            captureFilename: null,
            timesliceInMs: 5000,
            fps: 3,
            recorder: null
        };
    },
    props: ['videocapture'],
    created: function() {
    },
    methods: {
        createCaptureFilename: function() {
            let date = new Date();
            return "capture-" + date.getFullYear() + "-" + this.formatAs2Digits(date.getMonth())
                + "-" + this.formatAs2Digits(date.getDate()) + "T"
                + this.formatAs2Digits(date.getHours()) + "." + this.formatAs2Digits(date.getMinutes())
                + "." + this.formatAs2Digits(date.getSeconds()) + ".mov";
        },
        formatAs2Digits: function(digitsAsStr) {
            let digitsAsInt = Number(digitsAsStr);
            if(digitsAsInt < 10) {
                return "0" + digitsAsStr;
            }
            return digitsAsStr;
        },
        startCapture: function() {
              this.filename == null;
              let preview = document.getElementById("preview");
              navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
              }).then(stream => {
                preview.srcObject = stream;
                preview.captureStream = preview.captureStream || preview.mozCaptureStream;
                return new Promise(resolve => preview.onplaying = resolve);
              }).then(() => {
                this.buttonLabel = "stop capture";
                //this.recorder = new MediaRecorder(preview.captureStream(this.fps), { mimeType: 'video/webm; codecs="vp8, opus"'  });
                this.recorder = new MediaRecorder(preview.captureStream(this.fps));
                this.recorder.ondataavailable = this.handleDataAvailable;
                this.recorder.onstop = this.handleEndOfCapture;
                this.recorder.start(this.timesliceInMs);
              });
        },
        handleEndOfCapture: function() {
        },
        handleDataAvailable: function(event) {
            event.data.arrayBuffer().then(ab => {
                var initial = false;
                if(this.filename == null) {
                    this.filename = this.createCaptureFilename();
                    initial = true;
                }
        		this.videocapture(this.filename, convertToByteArray(new Int8Array(ab)), initial, this.timesliceInMs);
            });
        },
        stopRecorder: function() {
            if(this.recorder != null && this.recorder.state != 'inactive') {
                this.recorder.stop();
            }
        },
        toggleCapture: function() {
            if(this.buttonLabel == "start capture") {
                this.startCapture();
                this.buttonLabel = "activating capture";
            } else if(this.buttonLabel == "stop capture"){
                this.close();
            }
        },
        close: function () {
            this.buttonLabel = "start capture";
            this.stopRecorder();
            this.$emit("hide-video-capture");
        }
    }
}

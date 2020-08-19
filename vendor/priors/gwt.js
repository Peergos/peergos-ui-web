function convertToByteArray(target) {
    var source = peergos.shared.user.JavaScriptPoster.emptyArray();
    // This relies on internal implementation details of GWT's byte[] emulation
    target.___clazz = source.___clazz;
    target.castableTypeMap = source.castableTypeMap;
    target.typeMarker = source.typeMarker;
    target.__elementTypeCategory$ = source.__elementTypeCategory$;
    target.__elementTypeId$ = source.__elementTypeId$;
    var len = target.length;
    target.__proto__ = source.__proto__;
    target.length = len;
    return target;
}

function propsToFragment(props) {
    // Manually percent encode commas to work around some broken clients, like signal
    return encodeURI(JSON.stringify(props)).split(",").join("%2c");
}

function fragmentToProps(fragment) {
    var decoded = decodeURIComponent(fragment);
    return JSON.parse(decoded);
}

function getProm(url) {
    return getWithHeadersProm(url, []);
}

function getWithHeadersProm(url, headers) {
    console.log("getWithHeadersProm " + url);
    var future = peergos.shared.util.Futures.incomplete();
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = 'arraybuffer';
    var index = 0;
    while (index < headers.length){
	var name = headers[index++];
    	var value = headers[index++];
	if (name != "Host" && name != "Content-Length")
	    req.setRequestHeader(name, value);
    }
    
    req.onload = function() {
	console.log("http get returned retrieving " + url);
        // This is called even on 404 etc
        // so check the status
        if (req.status == 200) {
	    future.complete(convertToByteArray(new Int8Array(req.response)));
        } else if (req.status == 404) {
	    future.completeExceptionally(new peergos.shared.storage.HttpFileNotFoundException());
        } else {
	    future.completeExceptionally(Error(req.getResponseHeader("Trailer")));
        }
    };
    
    req.onerror = function(e) {
        future.completeExceptionally(Error("Network Error"));
    };
    
    req.send();
    return future;
}

function postProm(url, data) {
    console.log("postProm " + url);
    var future = peergos.shared.util.Futures.incomplete();
    new Promise(function(resolve, reject) {
	var req = new XMLHttpRequest();
	req.open('POST', url);
	req.responseType = 'arraybuffer';
	
	req.onload = function() {
	    console.log("http post returned retrieving " + url);
            // This is called even on 404 etc
            // so check the status
            if (req.status == 200) {
		resolve(new Int8Array(req.response));
            }
            else {
		try {
		    reject(req.getResponseHeader("Trailer"));
		} catch (e) {
		    reject(e);
		}
            }
	};
	
	req.onerror = function(e) {
            reject(Error("Network Error"));
	};

	req.send(data);
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(java.lang.Throwable.of(err));
        else
            future.complete(convertToByteArray(result));
    }, function(err) {
	future.completeExceptionally(java.lang.Throwable.of(err)); 
    });
    return future;
}

function postMultipartProm(url, dataArrays) {
    console.log("postMultipartProm " + url);
    var future = peergos.shared.util.Futures.incomplete();
    new Promise(function(resolve, reject) {
	var req = new XMLHttpRequest();
	req.open('POST', url);
	req.responseType = 'arraybuffer';
	
	req.onload = function() {
	    console.log("http post returned retrieving " + url);
            // This is called even on 404 etc
            // so check the status
            if (req.status == 200) {
		resolve(new Int8Array(req.response));
            }
            else {
		try {
		    reject(req.getResponseHeader("Trailer"));
		} catch (e) {
		    reject("Error");
		}
            }
	};
	
	req.onerror = function(e) {
	    console.log(e);
            reject(Error("Network Error"));
	};

	var form = new FormData();

	for (var i=0; i < dataArrays.array.length; i++)
	    form.append(i, new Blob([dataArrays.array[i]]));

        req.send(form);
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(java.lang.Throwable.of(err));
        else
            future.complete(convertToByteArray(result));
    }, function(err) {
	future.completeExceptionally(java.lang.Throwable.of(err)); 
    });
    return future;
}

function putProm(url, data, headers) {
    console.log("putProm " + url);
    var future = peergos.shared.util.Futures.incomplete();
    new Promise(function(resolve, reject) {
	var req = new XMLHttpRequest();
	req.open('PUT', url);
	req.responseType = 'arraybuffer';
	var index = 0;
	while (index < headers.length){
	    var name = headers[index++];
    	    var value = headers[index++];
	    if (name != "Host" && name != "Content-Length")
		req.setRequestHeader(name, value);
	}
	
	req.onload = function() {
	    console.log("http put returned retrieving " + url);
            // This is called even on 404 etc
            // so check the status
            if (req.status == 200) {
		resolve(new Int8Array(req.response));
            }
            else {
		reject("HTTP " + req.status);
            }
	};
	
	req.onerror = function(e) {
            reject(Error("Network Error"));
	};

	req.send(data);
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(java.lang.Throwable.of(err));
        else
            future.complete(convertToByteArray(result));
    }, function(err) {
	future.completeExceptionally(java.lang.Throwable.of(err)); 
    });
    return future;
}

var callback = {
    NativeJSScheduler: function() {
	    this.callAfterDelay = function callbackFunc(func, delay) {
           setTimeout(function(){
                func.call();
           }, delay);
       }
    }
};

var http = {
    NativeJSHttp: function() {
	this.get = getProm;
	this.getWithHeaders = getWithHeadersProm;
	this.post = postProm;
	this.postMultipart = postMultipartProm;
	this.put = putProm;
    }
};

function decodeUTF8(s) {
  var i, d = unescape(encodeURIComponent(s)), b = new Uint8Array(d.length);
  for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
  return b;
}

function decodeBase64(s) {
  if (typeof atob === 'undefined') {
    return new Uint8Array(Array.prototype.slice.call(new Buffer(s, 'base64'), 0));
  } else {
    var i, d = atob(s), b = new Uint8Array(d.length);
    for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
    return b;
  }
}

function hashToKeyBytesProm(username, password, algorithm) {
    var future = peergos.shared.util.Futures.incomplete();
    new Promise(function(resolve, reject) {
        console.log("making scrypt request");
        
        var t1 = Date.now();
        var hash = sha256(decodeUTF8(password));
        var salt = decodeUTF8(username)
	if (algorithm.getType().value != 1)
	    throw "Unknown UserGenerationAlgorithm type: " + algorithm.getType();
	var memCost = algorithm.memoryCost;
	var cpuCost = algorithm.cpuCost;
	var outputBytes = algorithm.outputBytes;
	var parallelism = algorithm.parallelism;
	if (parallelism != 1)
	    throw "Unimplemented scrypt parallelism: " + parallelism;
	
        scrypt(hash, salt, memCost, cpuCost, outputBytes, 1000, function(keyBytes) {
            console.log("JS Scrypt complete in: "+ (Date.now()-t1)+"mS");
            var hashedBytes = decodeBase64(keyBytes);
            resolve(hashedBytes);
        }, 'base64');  
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(err);
        else
            future.complete(convertToByteArray(new Int8Array(result)));
    });
    return future;
}

function generateRandomBytes(len) {    
    var bytes = nacl.randomBytes(len);
    return convertToByteArray(new Int8Array(bytes));
}

function generateSecretbox(data, nonce, key) {
    var bytes = nacl.secretbox(new Uint8Array(data), new Uint8Array(nonce), new Uint8Array(key));
    return convertToByteArray(new Int8Array(bytes));
}

function generateSecretbox_open(cipher, nonce, key) {
    var bytes = nacl.secretbox.open(new Uint8Array(cipher), new Uint8Array(nonce), new Uint8Array(key));
    if(bytes === false) {
        throw "Invalid encryption!";
    }
    return convertToByteArray(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
}

function generateCrypto_sign_open(signed, publicSigningKey) {    
    var bytes = nacl.sign.open(new Uint8Array(signed), new Uint8Array(publicSigningKey));
    return convertToByteArray(new Int8Array(bytes));
}

function generateCrypto_sign(message, secretSigningKey) {    
    var bytes = nacl.sign(new Uint8Array(message), new Uint8Array(secretSigningKey));
    return convertToByteArray(new Int8Array(bytes));
}

function generateCrypto_sign_keypair(publicKey, secretKey) {    
    var signSeed = new Uint8Array(secretKey.slice(0, 32));
    var signPair = nacl.sign.keyPair.fromSeed(signSeed);
    for (var i=0; i < signPair.secretKey.length; i++)
        secretKey[i] = signPair.secretKey[i];
    for (var i=0; i < signPair.publicKey.length; i++)
        publicKey[i] = signPair.publicKey[i];
    
    var returnArrays = [];
    returnArrays.push(publicKey);
    returnArrays.push(secretKey);
    return returnArrays;
}

function generateCrypto_box_open(cipher, nonce, theirPublicBoxingKey, ourSecretBoxingKey) {    
    var res = nacl.box.open(new Uint8Array(cipher), new Uint8Array(nonce), new Uint8Array(theirPublicBoxingKey), new Uint8Array(ourSecretBoxingKey));
    var i8Array = new Int8Array(res);
    return convertToByteArray(i8Array);
}

function generateCrypto_box(message, nonce, theirPublicBoxingKey, ourSecretBoxingKey) {    
    var res = nacl.box(new Uint8Array(message), new Uint8Array(nonce), new Uint8Array(theirPublicBoxingKey), new Uint8Array(ourSecretBoxingKey));
    var i8Array = new Int8Array(res);
    return convertToByteArray(i8Array);
}

function generateCrypto_box_keypair(publicKey, secretKey) {    
    var boxPair = nacl.box.keyPair.fromSecretKey(new Uint8Array(secretKey));
    for (var i=0; i < boxPair.publicKey.length; i++)
        publicKey[i] = boxPair.publicKey[i];
    
    return publicKey;
}

var scryptJS = {
    NativeScryptJS: function() {
        this.hashToKeyBytes = hashToKeyBytesProm;

	this.sha256 = function(input) {
	    var future = peergos.shared.util.Futures.incomplete();
	    window.crypto.subtle.digest(
		{
		    name: "SHA-256",
		},
		input
	    ).then(function(hash){
		//returns the hash as an ArrayBuffer
		var data = new Int8Array(hash);
		var res = convertToByteArray(data.slice(0, 32));
		future.complete(res);
	    }).catch(function(err){
		future.completeExceptionally(java.lang.Throwable.of(err));
	    });
	    return future;
	}

	this.blake2b = function(input, outputLength) {
		var data = new Int8Array(blake2b.blake2b(input, outputLength));
	    var res = convertToByteArray(data.slice(0, outputLength));
	    return res;
	}
    }
};

var ForkJoinJS = {
    JSForkJoinPool: function() {
	this.execute = function(task) {
	    setTimeout(() => task.run(), 0);
	}
    }
}

var thumbnail = {
    NativeJSThumbnail: function() {
        this.generateThumbnail = generateThumbnailProm;
        this.generateVideoThumbnail = generateVideoThumbnailProm;
    }   
};

var tweetNaCl = {
    JSNaCl: function() {
        this.randombytes = generateRandomBytes;
        this.secretbox = generateSecretbox;
        this.secretbox_open = generateSecretbox_open;

        this.crypto_sign_open = generateCrypto_sign_open;
        this.crypto_sign = generateCrypto_sign;
        this.crypto_sign_keypair = generateCrypto_sign_keypair;
        this.crypto_box_open = generateCrypto_box_open;
        this.crypto_box = generateCrypto_box;
        this.crypto_box_keypair = generateCrypto_box_keypair;
    }   
};

var browserio = {
    JSFileReader: function(file) {
	this.name = file.name;
	this.file = file;
	this.size = file.size;
	this.offset = 0;
	
	this.seek = function(hi, low) {
	    this.offset = low;
	    var fut = peergos.shared.util.Futures.incomplete();
	    fut.complete(true);
	    return fut;
	}

	this.readIntoArray = function(res, offset, length) {
	    var future = peergos.shared.util.Futures.incomplete();

	    var filereader = new FileReader();
	    filereader.file_name = file.name;
	    filereader.onload = function(){
		const data = new Uint8Array(this.result);
		for (var i=0; i < length; i++)
		    res[offset + i] = data[i];
		future.complete({value_0:length});
	    };
	    
	    filereader.readAsArrayBuffer(file.slice(this.offset, this.offset + length));
	    this.offset += length;
	    return future;
	}

	this.reset = function() {
	    this.offset = 0;
	    var fut = peergos.shared.util.Futures.incomplete();
	    fut.complete(true);
	    return fut;
	}

	this.close = function() {
	    
	}
    }
};

function generateThumbnailProm(asyncReader, fileSize, fileName) {
    var future = peergos.shared.util.Futures.incomplete();
    var bytes = peergos.shared.util.Serialize.newByteArray(fileSize);
    asyncReader.readIntoArray(bytes, 0, fileSize).thenApply(function(bytesRead) {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.onload = function(){
            var w = 100, h = 100;
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img,0,0,img.width, img.height, 0, 0, w, h);
            var b64Thumb = canvas.toDataURL().substring("data:image/png;base64,".length);
            future.complete(b64Thumb);
        }
	img.onerror = function(e) {
	    console.log(e);
	    future.complete("");
	}
        var blob = new Blob([new Uint8Array(bytes)], {type: "octet/stream"});
        var url = window.URL.createObjectURL(blob);
        img.src = url;
    });
    return future;
}

function supportsStreaming() {
    try {
        return 'serviceWorker' in navigator && !!new ReadableStream() && !!new WritableStream()
    } catch(err) {
        return false;
    }
}

function generateVideoThumbnailProm(asyncReader, fileSize, fileName, mimeType) {
    var future = peergos.shared.util.Futures.incomplete();
    if(supportsStreaming() && fileSize > 50 * 1000 * 1000) {
        return createVideoThumbnailStreamingProm(future, asyncReader, fileSize, fileName, mimeType);
    }else{
        return createVideoThumbnailProm(future, asyncReader, fileSize, fileName);
    }
}

function createVideoThumbnailProm(future, asyncReader, fileSize, fileName) {
    let bytes = peergos.shared.util.Serialize.newByteArray(fileSize);
    asyncReader.readIntoArray(bytes, 0, fileSize).thenApply(function(bytesRead) {
        var increment = 0;
        var currentIncrement = 0;                                                   
        let width = 100, height = 100;   
        let video = document.createElement('video');
        video.onloadedmetadata = function(){
            let thumbnailGenerator = () => {
                let duration = video.duration;
                if(increment == 0) {
                    increment = duration / 10;
                    currentIncrement = increment; //skip over intro                                          
                }
                currentIncrement = currentIncrement + increment;
                if(currentIncrement < duration){
                    captureThumbnail(width, height, currentIncrement, video).thenApply((thumbnail)=>{
                        if(thumbnail.length == 0){
                            setTimeout(function(){thumbnailGenerator();}, 1000);
                        } else {
                            future.complete(thumbnail);
                        }
                    })
                } else {
                    future.complete("");
                }
            };
            thumbnailGenerator();
       };
        video.onerror = function(e) {
            console.log(e);
            future.complete("");
        }
        let blob = new Blob([new Uint8Array(bytes)], {type: "octet/stream"});
        let url = window.URL.createObjectURL(blob);
        video.src = url;
    });
    return future;
}
function captureThumbnail(width, height, currentIncrement, video){
    let capturingFuture = peergos.shared.util.Futures.incomplete();   
    video.currentTime = currentIncrement;

    let canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    let blackWhiteThreshold = width * height / 10 * 8; //80%
    setTimeout(() => {
            let context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, width, height);
            let imageData = context.getImageData(0, 0, width, height);
            if(isLikelyValidImage(imageData, blackWhiteThreshold)) {
                let b64Thumb = canvas.toDataURL().substring("data:image/png;base64,".length);
                capturingFuture.complete(b64Thumb);
            }else {
                capturingFuture.complete("");
            }
    }, 1000);
    return capturingFuture;
}

//Make sure image is not all black or all white
function isLikelyValidImage(imageData, blackWhiteThreshold) {
    let pix = imageData.data;
    var blackCount = 0;
    var whiteCount = 0;
    var isValidImage = true;
    for (var i = 0, n = pix.length; i < n; i += 4) {
        let total = pix[i] + pix[i+1] + pix[i+2];
        if(total < 20) {
            if(++blackCount > blackWhiteThreshold) {
                isValidImage = false;
                break;
            }
        }else if(total > 760) {
            if(++whiteCount > blackWhiteThreshold) {
                isValidImage = false;
                break;
            }
        }
    }
    return isValidImage;
}

function createVideoThumbnailStreamingProm(future, asyncReader, size, filename, mimeType) {
    let maxBlockSize = 1024 * 1024 * 5;
    var blockSize = size > maxBlockSize ? maxBlockSize : size;
    var result = { done: false};
    function Context(asyncReader, sizeHigh, sizeLow) {
        this.maxBlockSize = 1024 * 1024 * 5;
        this.writer = null;
        this.asyncReader = asyncReader;
        this.sizeHigh = sizeHigh,
        this.sizeLow = sizeLow;
        this.counter = 0;
        this.stream = function(seekHi, seekLo, length) {
            this.counter++;
            var work = function(thatRef, currentCount) {
                var currentSize = length;
                var blockSize = currentSize > this.maxBlockSize ? this.maxBlockSize : currentSize;
                var pump = function(reader) {
                    if(! result.done && blockSize > 0 && thatRef.counter == currentCount) {
                        var data = convertToByteArray(new Uint8Array(blockSize));
                        data.length = blockSize;
                        reader.readIntoArray(data, 0, blockSize).thenApply(function(read){
                               currentSize = currentSize - read.value_0;
                               blockSize = currentSize > thatRef.maxBlockSize ? thatRef.maxBlockSize : currentSize;
                               thatRef.writer.write(data);
                               pump(reader);
                        });
                    }
                }
                asyncReader.seekJS(seekHi, seekLo).thenApply(function(seekReader){
                    pump(seekReader);
                })
            }
            var empty = convertToByteArray(new Uint8Array(0));
            this.writer.write(empty);
            work(this, this.counter);
        }
    }
    const context = new Context(asyncReader, 0, size);
    let fileStream = streamSaver.createWriteStream("media-" + filename, mimeType, function(url){
        let width = 100, height = 100;
        let video = document.createElement('video');
        let canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        let blackWhiteThreshold = width * height / 10 * 8; //80%
        video.muted = true;

        video.onerror = function(e) {
            console.log("unable to create video thumbnail onerror: " + e);
            if(! result.done) {
                result.done = true;
                future.complete("");
            }
        }

        video.onloadedmetadata = function(){
            video.currentTime = 10;
        }
        video.oncanplay = function(){
            let thumbnailGenerator = () => {
                try {
                    //console.log("in oncanplay time= " + video.currentTime);
                    if (! result.done) {
                        if (video.currentTime >= 10) {
                            if (video.currentTime >= video.duration || video.currentTime > 30) {
                                console.log("unable to create video thumbnail within time");
                                result.done = true;
                                future.complete("");
                            }
                            let context = canvas.getContext('2d');
                            context.drawImage(video, 0, 0, width, height);
                            let imageData = context.getImageData(0, 0, width, height);
                            if (isLikelyValidImage(imageData, blackWhiteThreshold)) {
                                result.done = true;
                                let b64Thumb = canvas.toDataURL().substring("data:image/png;base64,".length);
                                future.complete(b64Thumb);
                            } else {
                                if (! result.done) {
                                    setTimeout(function(){thumbnailGenerator();}, 1000);
                                }
                            }
                        } else {
                            setTimeout(function(){thumbnailGenerator();}, 1000);
                        }
                    }
                }catch(e) {
                    console.log("unable to create video thumbnail: " + e);
                    result.done = true;
                    future.complete("");
                }
            };
            if(! result.done) {
                setTimeout(function(){thumbnailGenerator();}, 1000);
            }
        }
        video.src = url;
        video.play();
    }, function(seekHi, seekLo, seekLength){
        if(! result.done) {
            context.stream(seekHi, seekLo, seekLength);
        }
    }, undefined, size);
    context.writer = fileStream.getWriter();
    return future;
}

let heading = document.querySelector('h1');
heading.textContent = 'CLICK ANYWHERE TO START'
document.body.addEventListener('click', init);


var fftSize = 1024;
var numFFTsToKeep = 48;
var hannWindow = [];
var ffts = [];

function hann( window )
{
    var phase = 0.0;
    var delta = 2 * Math.PI / fftSize;
    for( var i = 0; i < fftSize; i++ )
    {
        window[i] = (0.5 * (1.0 - Math.cos(phase)));
        phase += delta;
    }
}
hann( hannWindow );

function init() {
  // heading.textContent = 'sndpeek';
  heading.parentNode.removeChild( heading );
  document.body.removeEventListener('click', init)

  // Older browsers might not implement mediaDevices at all, so we set an empty object first
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }


  // Some browsers partially implement mediaDevices. We can't just assign an object
  // with getUserMedia as it would overwrite existing properties.
  // Here, we will just add the getUserMedia property if it's missing.
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function(constraints) {

      // First get ahold of the legacy getUserMedia, if present
      var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

      // Some browsers just don't implement it - return a rejected promise with an error
      // to keep a consistent interface
      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
      }

      // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
      return new Promise(function(resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    }
  }



  // set up forked web audio context, for multiple browsers
  // window. is needed otherwise Safari explodes

  var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var source;
  var stream;


  //set up the different audio nodes we will use for the app

  var analyser = audioCtx.createAnalyser();
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = 0.85;
  var gainNode = audioCtx.createGain();

  // set up canvas context for visualizer

  var canvas = document.querySelector('.visualizer');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  initCanvas( canvas );
  var drawVisual;


  //main block for doing the audio recording

  if (navigator.mediaDevices.getUserMedia) {
     console.log('getUserMedia supported.');
     var constraints = {audio: true}
     navigator.mediaDevices.getUserMedia (constraints)
        .then(
          function(stream) {
             source = audioCtx.createMediaStreamSource(stream);
             source.connect(gainNode);
             gainNode.connect(analyser);

          	 visualize();
        })
        .catch( function(err) { console.log('The following gUM error occured: ' + err);})
  } else {
     console.log('getUserMedia not supported on your browser!');
  }

  function visualize() {
    WIDTH = 2; //canvas.width;
    HEIGHT = 2; //canvas.height;


    var visualSetting = "sinewave";

    if(visualSetting === "sinewave") {
      analyser.fftSize = fftSize;
      var bufferLength = analyser.fftSize;
      console.log(bufferLength);
      var dataArray = new Uint8Array(bufferLength);
      

      function drawTimeDomain() 
      {
          analyser.getByteTimeDomainData( dataArray );

          
          var points = new Float32Array( fftSize * 3 );
          var colors = new Float32Array( fftSize * 3 );

          var percentWidth = 0.7;
          var sliceWidth = WIDTH * percentWidth / bufferLength;
          var x = -percentWidth;

          for( var i = 0; i < bufferLength; i++ ) 
          {
              var v = hannWindow[i] * ( ( dataArray[i] / 128.0 ) - 1 );
              var y = HEIGHT * 1.2 / 4 + v * HEIGHT / 8;
              var z = 0;
            
              points[ i*3 + 0 ] = x;
              points[ i*3 + 1 ] = y;
              points[ i*3 + 2 ] = z;
              colors[ i*3 + 0 ] = 0.4;
              colors[ i*3 + 1 ] = 0.4;
              colors[ i*3 + 2 ] = 1.0;

              x += sliceWidth;
          }

          drawLine( gl, points, colors );
      };
      
      function drawFreqDomain()
      {
          analyser.getByteFrequencyData(dataArray);
          ffts.push( dataArray );
          while( ffts.length >  numFFTsToKeep )
          {
              ffts.shift();
          }
          
          for( var i = 0; i < ffts.length; i++ )
          {
              // remember, the BACK of ffts is the most recent fft   
          }
      }


      var draw = function()
      {
          drawVisual = requestAnimationFrame( draw );
          initFrame( gl );
          drawTimeDomain();
          drawFreqDomain();
      }
      
      draw();
      

    } else if(visualSetting == "frequencybars") {
      analyser.fftSize = 256;
      var bufferLengthAlt = analyser.frequencyBinCount;
      console.log(bufferLengthAlt);
      var dataArrayAlt = new Uint8Array(bufferLengthAlt);

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

      var drawAlt = function() {
        drawVisual = requestAnimationFrame(drawAlt);

        analyser.getByteFrequencyData(dataArrayAlt);

        canvasCtx.fillStyle = 'rgb(0, 0, 0)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        var barWidth = (WIDTH / bufferLengthAlt) * 2.5;
        var barHeight;
        var x = 0;

        for(var i = 0; i < bufferLengthAlt; i++) {
          barHeight = dataArrayAlt[i];

          canvasCtx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
          canvasCtx.fillRect(x,HEIGHT-barHeight/2,barWidth,barHeight/2);

          x += barWidth + 1;
        }
      };

      drawAlt();

    } else if(visualSetting == "off") {
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      canvasCtx.fillStyle = "red";
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    }

  }

  
}

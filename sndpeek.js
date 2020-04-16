let heading = document.querySelector('h1');
heading.textContent = 'CLICK TO PEEK SND'
document.body.addEventListener('click', init);


var bufferSize = 1024;
var fftSize = 512;
var numFFTsToKeep = 48;
var hannWindow = [];
var logSpacingFactor = 0.3;
var logSpacing = [];
var ffts = [];

var debugme = true;

function hann( window )
{
    var phase = 0.0;
    var delta = 2 * Math.PI / bufferSize;
    for( var i = 0; i < bufferSize; i++ )
    {
        window[i] = (0.5 * (1.0 - Math.cos(phase)));
        phase += delta;
    }
}
hann( hannWindow );

function computeLogSpacing( spacing, power )
{
    for( var i = 0; i < fftSize; i++ )
    {
        spacing[i] = Math.pow( i * 1.0 / fftSize, power );
    }
}
computeLogSpacing( logSpacing, logSpacingFactor );

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
    // field of view: 45
    // clipping planes: 1, 300
    // camera pos: 0, 0, 3.5
    // look at: 0, 0, 0
    // camera up: 0, 1, 0
    initCanvas( canvas, 45, 1, 300, [0, -0.5, 3.5], [0, 0, 0], [0, 1, 0] );
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

        analyser.fftSize = bufferSize;
        var dataArray = new Uint8Array( bufferSize );
    

        function drawTimeDomain() 
        {
            analyser.getByteTimeDomainData( dataArray );

        
            var points = new Float32Array( bufferSize * 3 );
            var colors = new Float32Array( bufferSize * 3 );

            var percentWidth = 2.0;
            var sliceWidth = WIDTH * percentWidth / bufferSize;
            var x = -percentWidth;

            for( var i = 0; i < bufferSize; i++ ) 
            {
                var v = hannWindow[i] * ( ( dataArray[i] / 128.0 ) - 1 );
                var y = HEIGHT * 0.48 + v * HEIGHT / 8;
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
            analyser.getByteFrequencyData( dataArray );
            ffts.push( new Uint8Array( dataArray ) );
            while( ffts.length >  numFFTsToKeep )
            {
                ffts.shift();
            }
            
          
            var points = new Float32Array( fftSize * 3 );
            var colors = new Float32Array( fftSize * 3 );
          
            var percentWidth = 2.0;
        
            for( var j = 0; j < ffts.length; j++ )
            {
                // remember, the BACK of ffts is the most recent fft  
                var current_fft = ffts[ ffts.length - 1 - j ];
                
                for( var i = 0; i < current_fft.length; i++ )
                {
                    var x = percentWidth * ( 2.0 * logSpacing[i] - 1 );
                    var v = current_fft[i] / 128;
                    var y = HEIGHT * -0.5 + v * HEIGHT / 4 + j / 16;
                    var z = -j / 8;
                    
                    var g_wf_delay = 0;
                    var fval = ( numFFTsToKeep - g_wf_delay - j ) * 1.0 / numFFTsToKeep; 
                    
                    points[ i*3 + 0 ] = x;
                    points[ i*3 + 1 ] = y;
                    points[ i*3 + 2 ] = z;
                    colors[ i*3 + 0 ] = 0.4 * fval;
                    colors[ i*3 + 1 ] = 1.0 * fval;
                    colors[ i*3 + 2 ] = 0.4 * fval;
                }
                
                drawLine( gl, points, colors );

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

    }
  
}

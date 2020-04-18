let heading = document.querySelector('h1');
heading.textContent = 'CLICK TO RAINBOW ICE'
document.body.addEventListener('click', init);


var bufferSize = 1024;
var fftSize = 512;
var hannWindow = [];
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
    var fov = 45;
    var clipNear = 1;
    var clipFar = 300;
    var cameraPos = [0, 0.0, 10.0];
    var lookAt = [0, -0.75, 0];
    var cameraUp = [0, 1, 0];
    initCanvas( canvas, fov, clipNear, clipFar, cameraPos, lookAt, cameraUp );
    
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

    function visualize()
    {
        WIDTH = canvas.width / 1000;
        HEIGHT = canvas.height / 1000;

        analyser.fftSize = bufferSize;
        var dataArray = new Uint8Array( bufferSize );
        
        var fftVisualMultiplier = 20;
        var waveformVisualMultiplier = 120;
        var xCircle = [];
        var yCircle = [];
        var phaseShift = 7 * Math.PI / 8;
        var diameter = 1.5;
        var yMelt = [];
        var fftBins = [];
        var srate = 44100;
        var binHZ = srate / fftSize;
        var nInnerCircles = 43;
        var nConeLines = nInnerCircles;
        var drawInnerCircles = true;
        var shouldMelt = true;
        var centroid;
        var nOuterCircles = Math.floor( nInnerCircles * 1.5 );
        var shouldBoom = true;
        var shouldRandomizeBoomCenters = false;
        var timeBetweenBooms = 7;
        var timeSinceBoom = 0;

        function computeCircleAmounts()
        {
            for( var i = 0; i < fftSize; i++ )
            {
                xCircle[i] = Math.cos( -2 * Math.PI * Math.sqrt( i * 1.0 / (fftSize - 1)) + phaseShift);
                yCircle[i] = Math.sin( -2 * Math.PI * Math.sqrt( i * 1.0 / (fftSize - 1)) + phaseShift);
                yMelt[i] = ( i % 8 == 0 ) ? Math.random() : 0;
                fftBins[i] = i * binHZ;
            }
        }
        computeCircleAmounts();

        // TODO:
        // - compute circle and melt base arrays
        // - show FFTs
        // - compute spectral centroid
        // - compute moving average of spectral centroid
        // - use moving average for melting
        // - compute loudness
        // - implement boom class
        // - use loudness to trigger booms
        // - keyboard interface
        // --- ¿c/C: cone lines?
        // --- i/I: inner circles
        // --- m/M: melting
        // --- b/B: booms
        // --- r/R: randomize center of booms
    

        function drawTimeDomain() 
        {
            analyser.getByteTimeDomainData( dataArray );

        
            var points = new Float32Array( bufferSize * 3 );
            var colors = new Float32Array( bufferSize * 3 );
            
            for( var j = 0; j < nConeLines; j++ )
            {
                var lx, ly, lxinc, lyinc;
                // start points: left half
                lx = diameter * ( nInnerCircles - j ) / nInnerCircles * Math.cos( 9 * Math.PI / 8 );
                ly = diameter * Math.sin((9 * Math.PI / 8) + ((3 * Math.PI / 8 ) * j / nConeLines)) - j*1.0/30;
                // increment values
                lxinc = -lx / bufferSize;
                lyinc = (-4.2 - ly) / bufferSize;

                for( var i = 0; i < bufferSize; i++ )
                {
                    var v = hannWindow[i] * ( ( dataArray[i] / 128.0 ) - 1 );
                    var x = lx + lyinc * waveformVisualMultiplier * v;
                    var y = ly - lxinc * waveformVisualMultiplier * v;
                    var z = -10.0 * j / nConeLines;
                    
                    
                    points[ i*3 + 0 ] = x;
                    points[ i*3 + 1 ] = y;
                    points[ i*3 + 2 ] = z;
                    // brown
                    colors[ i*3 + 0 ] = 0.804;
                    colors[ i*3 + 1 ] = 0.608;
                    colors[ i*3 + 2 ] = 0.114;
                    
                    lx += lxinc;
                    ly += lyinc;
                }

                // draw left half
                drawLine( gl, points, colors );

                // now right half!
                lx = diameter * (nInnerCircles - j) / nInnerCircles * Math.cos(- Math.PI / 8);
                ly = diameter * Math.sin((- Math.PI / 8) - ((3 * Math.PI / 8) * j / nConeLines)) - j*1.0/30;
                lxinc = -lx / bufferSize;
                lyinc = (-4.2 - ly) / bufferSize;

                for( var i = 0; i < bufferSize; i++ )
                {
                    var v = hannWindow[i] * ( ( dataArray[i] / 128.0 ) - 1 );
                    var x = lx + lyinc * waveformVisualMultiplier * v;
                    var y = ly - lxinc * waveformVisualMultiplier * v;
                    var z = -10.0 * j / nConeLines;
                    
                    
                    points[ i*3 + 0 ] = x;
                    points[ i*3 + 1 ] = y;
                    points[ i*3 + 2 ] = z;
                    // brown
                    colors[ i*3 + 0 ] = 0.804;
                    colors[ i*3 + 1 ] = 0.608;
                    colors[ i*3 + 2 ] = 0.114;
                    
                    lx += lxinc;
                    ly += lyinc;
                }
                
                // draw right half
                drawLine( gl, points, colors );
            }
        };
    
        function drawFreqDomain()
        {
            analyser.getByteFrequencyData( dataArray );
            ffts.push( new Uint8Array( dataArray ) );
            while( ffts.length >  nInnerCircles )
            {
                ffts.shift();
            }
            
          
            var points = new Float32Array( fftSize * 3 );
            var colors = new Float32Array( fftSize * 3 );
          
        
            for( var j = 0; j < ffts.length; j++ )
            {
                // remember, the BACK of ffts is the most recent fft  
                var current_fft = ffts[ ffts.length - 1 - j ];
                
                for( var i = 0; i < current_fft.length; i++ )
                {
                    var x = percentWidth * ( 2.0 * logSpacing[i] - 1 );
                    var v = current_fft[i] / 128;
                    var y = HEIGHT * -1.3 + v * HEIGHT / 4 + j / 16;
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
            //drawFreqDomain();
        }
    
        draw();

    }
    
    window.onresize = function()
    {
        window.cancelAnimationFrame( drawVisual );
        resizeGL( canvas, fov, clipNear, clipFar, cameraPos, lookAt, cameraUp );
        visualize();
    }
  
}



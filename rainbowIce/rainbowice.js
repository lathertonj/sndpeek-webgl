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
        var fftNormalizer = 8192 * 4;
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
        var nConeLines = 1;// nInnerCircles;
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

        function setColor( colors, index, value )
        {
            if( value > 0.8 )
            {
                // red
                colors[index + 0] = 0.859;
                colors[index + 1] = 0.078;
                colors[index + 2] = 0.234;
            }
            else if( value > 0.66 )
            {
                // orange
                colors[index + 0] = 1.0;
                colors[index + 1] = 0.647;
                colors[index + 2] = 0.0;
            }
            else if( value > 0.52 )
            {
                // yellow
                colors[index + 0] = 1.0;
                colors[index + 1] = 0.843;
                colors[index + 2] = 0.0;
            }
            else if( value > 0.38 )
            {
                // green
                colors[index + 0] = 0.0;
                colors[index + 1] = 0.804;
                colors[index + 2] = 0.0;
            }
            else if( value > 0.24 )
            {
                // blue
                colors[index + 0] = 0.117;
                colors[index + 1] = 0.564;
                colors[index + 2] = 1.0;
            }
            else if( value > 0.1 )
            {
                // purple
                colors[index + 0] = 0.490;
                colors[index + 1] = 0.149;
                colors[index + 2] = 0.804;
            }
            else
            {
                // white
                colors[index + 0] = 0.98;
                colors[index + 1] = 0.97;
                colors[index + 2] = 0.94;
            }
        }

        // TODO:
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

            if( debugme )
            {
                debugme = false;
                console.log( dataArray );
            }
            
          
            var points = new Float32Array( fftSize * 3 );
            var colors = new Float32Array( fftSize * 3 );

            // outermost circle has different rules than everything else
            for( var i = 0; i < fftSize; i++ )
            {
                var fftValue = fftVisualMultiplier * Math.sqrt( dataArray[i] / fftNormalizer );
                // squash the first and last sample of the fft to connect the circle
                if( i == 0 || i == fftSize - 1 ) { fftValue = 0; }

                // x, y, z
                points[ i*3 + 0 ] = xCircle[i] * ( diameter + fftValue / 2.5 );
                points[ i*3 + 1 ] = yCircle[i] * ( diameter + fftValue / 2.5 );
                points[ i*3 + 2 ] = 0;
                // color
                setColor( colors, i*3, fftValue );
            }
            drawLine( gl, points, colors );
          
            // inner circles
            if( drawInnerCircles )
            {
                // TODO compute melt amount
                var meltAmount = 0;
                for( var j = 0; j < ffts.length - 1; j++ )
                {
                    // remember, the BACK of ffts is the most recent fft
                    var current_fft = ffts[ ffts.length - 1 - j ];

                    for( var i = 0; i < fftSize; i++ )
                    {
                        var fftValue = fftVisualMultiplier * Math.sqrt( current_fft[i] / fftNormalizer );

                        // x, y, z
                        points[ i*3 + 0 ] = xCircle[i] * diameter * ( nInnerCircles - j ) / nInnerCircles;
                        points[ i*3 + 1 ] = yCircle[i] * diameter * ( nInnerCircles - j ) / nInnerCircles
                            - ( 1.5 * meltAmount * yMelt[(i + j*(fftSize - 17)) % fftSize]);
                        points[ i*3 + 2 ] = -1.5 * j / nInnerCircles;
                        // color
                        setColor( colors, i*3, fftValue );
                    }

                    // draw line
                    drawLine( gl, points, colors );
                }
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
    
    window.onresize = function()
    {
        window.cancelAnimationFrame( drawVisual );
        resizeGL( canvas, fov, clipNear, clipFar, cameraPos, lookAt, cameraUp );
        visualize();
    }
  
}



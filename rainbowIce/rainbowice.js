var tutorial = document.getElementById('tutorial');
document.body.addEventListener('click', init);


var bufferSize = 1024;
var fftSize = 512;
var fftVisualMultiplier = 30;        
var waveformVisualMultiplier = 120;
var hannWindow = [];
var ffts = [];
var drawInnerCone = true;
var drawInnerCircles = true;
var shouldMelt = true;
var shouldBoom = true;
var shouldRandomizeBoomCenters = true;
// respond to keypresses
document.onkeypress = function( keyEvent )
{
    switch( keyEvent.code )
    {
        case "KeyC":
            // hide / show cone lines
            drawInnerCone = !drawInnerCone;
            break;
        case "KeyI":
            // hide / show inner circles
            drawInnerCircles = !drawInnerCircles;
            break;
        case "KeyM":
            // melt / don't melt
            shouldMelt = !shouldMelt;
            break;
        case "KeyB":
            // boom / don't boom
            shouldBoom = !shouldBoom;
            break;
        case "KeyR":
            // randomize boom centers / don't
            shouldRandomizeBoomCenters = !shouldRandomizeBoomCenters;
            break;
        default:
            break;
    }
}

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
    tutorial.parentNode.removeChild( tutorial );
    document.body.removeEventListener('click', init)
    document.body.className = "noscroll";

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
        var dataArray = new Float32Array( bufferSize );
        

        var xCircle = [];
        var yCircle = [];
        var phaseShift = 7 * Math.PI / 8;
        var diameter = 1.5;
        var yMelt = [];
        var fftBins = [];
        var srate = 44100;
        var binHZ = srate / fftSize;
        var nInnerCircles = 43;
        var currentMeltAmount = 0;
        var goalMeltAmount = 0;
        var meltSlewUp = 0.01;
        var meltSlewDown = 0.03;
        var currentSignalEnergy = 0;
        var nOuterCircles = Math.floor( nInnerCircles * 1.5 );
        var nOuterCirclesShowing = 3;
        var booms = [];
        var timeBetweenBooms = 7;
        var timeSinceBoom = 0;
        
        // compute circles
        for( var i = 0; i < fftSize; i++ )
        {
            xCircle[i] = Math.cos( -2 * Math.PI * Math.sqrt( i * 1.0 / (fftSize - 1)) + phaseShift);
            yCircle[i] = Math.sin( -2 * Math.PI * Math.sqrt( i * 1.0 / (fftSize - 1)) + phaseShift);
            yMelt[i] = ( i % 8 == 0 ) ? Math.random() : 0;
            fftBins[i] = i * binHZ;
        }

        // time domain: cone
        function drawTimeDomain() 
        {
            analyser.getFloatTimeDomainData( dataArray );

        
            var points = new Float32Array( bufferSize * 3 );
            var colors = new Float32Array( bufferSize * 4 );

            // compute signal energy
            currentSignalEnergy = 0;
            for( var i = 0; i < bufferSize; i++ )
            {
                currentSignalEnergy += Math.abs( dataArray[i] );
            }
            
            var nConeLines = drawInnerCone ? nInnerCircles : 1;
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
                    var v = hannWindow[i] * dataArray[i];
                    var x = lx + lyinc * waveformVisualMultiplier * v;
                    var y = ly - lxinc * waveformVisualMultiplier * v;
                    var z = -10.0 * j / nConeLines;
                    
                    
                    points[ i*3 + 0 ] = x;
                    points[ i*3 + 1 ] = y;
                    points[ i*3 + 2 ] = z;
                    // brown
                    colors[ i*4 + 0 ] = 0.804;
                    colors[ i*4 + 1 ] = 0.608;
                    colors[ i*4 + 2 ] = 0.114;
                    colors[ i*4 + 3 ] = 1.0;
                    
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
                    var v = hannWindow[i] * dataArray[i];
                    var x = lx + lyinc * waveformVisualMultiplier * v;
                    var y = ly - lxinc * waveformVisualMultiplier * v;
                    var z = -10.0 * j / nConeLines;
                    
                    
                    points[ i*3 + 0 ] = x;
                    points[ i*3 + 1 ] = y;
                    points[ i*3 + 2 ] = z;
                    // brown
                    colors[ i*4 + 0 ] = 0.804;
                    colors[ i*4 + 1 ] = 0.608;
                    colors[ i*4 + 2 ] = 0.114;
                    colors[ i*4 + 3 ] = 1.0;
                    
                    lx += lxinc;
                    ly += lyinc;
                }
                
                // draw right half
                drawLine( gl, points, colors );
            }
        };
    
        // freq domain: ice
        function drawFreqDomain()
        {
            analyser.getFloatFrequencyData( dataArray );

            // preprocess
            for( var i = 0; i < dataArray.length; i++ )
            {
                // dB to sqrt( amplitude ratio )
                dataArray[i] = Math.sqrt( Math.pow( 10, dataArray[i] / 20 ) * 1 );
            }

            ffts.push( new Float32Array( dataArray ) );
            while( ffts.length >  nInnerCircles )
            {
                ffts.shift();
            }

            var points = new Float32Array( fftSize * 3 );
            var colors = new Float32Array( fftSize * 4 );
            var spectralCentroid = 0;
            var fftSum = 0;


            // outermost circle has different rules than everything else
            for( var i = 0; i < fftSize; i++ )
            {
                var fftValue = fftVisualMultiplier * dataArray[i];
                // squash the first and last sample of the fft to connect the circle
                if( i == 0 || i == fftSize - 1 ) { fftValue = 0; }

                // x, y, z
                points[ i*3 + 0 ] = xCircle[i] * ( diameter + fftValue / 2.5 );
                points[ i*3 + 1 ] = yCircle[i] * ( diameter + fftValue / 2.5 );
                points[ i*3 + 2 ] = 0;
                // color
                setColor( colors, i*4, fftValue );

                // also compute spectral centroid, ignoring very quiet noise
                spectralCentroid += Math.max( dataArray[i] - 0.005, 0 ) * fftBins[i];
                fftSum += dataArray[i];
            }

            drawLine( gl, points, colors );

            // also compute spectral centroid
            if( fftSum > 0 ) { spectralCentroid /= fftSum; }
          
            // inner circles
            // compute melt amount
            goalMeltAmount = shouldMelt ? Math.max( spectralCentroid / 25000 - 0.08, 0.0) : 0;
            currentMeltAmount += ( goalMeltAmount > currentMeltAmount ? meltSlewUp : meltSlewDown )
                * ( goalMeltAmount - currentMeltAmount );
            for( var j = 0; j < (drawInnerCircles ? ffts.length - 1 : 1); j++ )
            {
                // remember, the BACK of ffts is the most recent fft
                var current_fft = ffts[ ffts.length - 1 - j ];

                for( var i = 0; i < fftSize; i++ )
                {
                    var fftValue = fftVisualMultiplier * current_fft[i];

                    // x, y, z
                    points[ i*3 + 0 ] = xCircle[i] * diameter * ( nInnerCircles - j ) / nInnerCircles;
                    points[ i*3 + 1 ] = yCircle[i] * diameter * ( nInnerCircles - j ) / nInnerCircles
                        - ( 1.5 * currentMeltAmount * yMelt[(i + j*(fftSize - 17)) % fftSize]);
                    points[ i*3 + 2 ] = -1.5 * j / nInnerCircles;
                    // color
                    setColor( colors, i*4, fftValue );
                }

                // draw line
                drawLine( gl, points, colors );
            }

            // decide whether to spawn a boom
            if( shouldBoom && timeSinceBoom >= timeBetweenBooms && currentSignalEnergy > 0.04 * fftSize )
            {
                var x = 0;
                var y = 0;
                // randomize boom centers if a boom is being shown in the center
                if( shouldRandomizeBoomCenters && booms.length != 0 )
                {
                    x = Math.random() + 0.8;
                    y = Math.random() + 0.8;
                    if( Math.random() < 0.5 ) { x *= -1; }
                    if( Math.random() < 0.5 ) { y *= -1; }

                    x *= diameter;
                    y *= diameter;
                }

                // construct boom
                booms.push( newBoom( 
                    dataArray, 
                    nOuterCircles, nOuterCirclesShowing, 
                    diameter, xCircle, yCircle, 
                    // data we actually constructed here
                    x, y 
                ) );

                timeSinceBoom = 0;
            }
            else
            {
                timeSinceBoom++;
            }
        }

        // booms: fireworks!
        function drawBooms()
        {
            // boom animation
            for( var i = 0; i < booms.length; i++ )
            {
                // draw boom
                boom.draw( booms[i] );

                // advance time on boom
                boom.advanceTime( booms[i] );
            }

            // only keep booms that have not finished
            var oldBooms = booms;
            booms = [];
            for( var i = 0; i < oldBooms.length; i++ )
            {
                if( !boom.doneDrawing( oldBooms[i] ) )
                {
                    booms.push( oldBooms[i] );
                }
            }
        }


        var draw = function()
        {
            drawVisual = requestAnimationFrame( draw );
            initFrame( gl );
            // one frame too late :(
            // for the blending to work properly, transparent things need to be rendered
            // first, for some reason
            drawBooms();
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

function newBoom( fftValues, numCircles, numCirclesShowing, diameter, xCircle, yCircle, centerX, centerY )
{
    var newBoom = {
        nCircles: numCircles,
        nCirclesShowing: numCirclesShowing,
        myXCircle: xCircle,
        myYCircle: yCircle,
        myCenterX: centerX,
        myCenterY: centerY,
        myDiameter: diameter,
        myFFT: new Float32Array( fftValues ),
        myTimeStep: 0 // or 3?
    };
    console.log( "Boom!" );
    return newBoom;
}

boom = {
    advanceTime: function( b )
    {
        b.myTimeStep += 1;
        
    },
    doneDrawing: function( b )
    {
        // is boom finished drawing?
        return b.myTimeStep > b.nCircles + b.nCirclesShowing;
    },
    draw: function( b )
    {
        // draw boom lines from the outside in
        var boomIndex = b.myTimeStep;
        var fftSize = b.myFFT.length;
        var points = new Float32Array( fftSize * 3 );
        var colors = new Float32Array( fftSize * 4 );

        for( var i = boomIndex; i >= Math.max( boomIndex - b.nCirclesShowing, 0 ); i-- )
        {
            for( var k = 0; k < fftSize; k++ )
            {
                var fftValue = 0;
                // as i increases, start to smooth out the FFT over a larger and larger window
                for( var l = -i * 2; l < i * 2; l++ )
                {
                    fftValue += fftVisualMultiplier 
                        * b.myFFT[(k + l + fftSize) % fftSize]
                        / ( 5 * i );
                }

                // x, y, z
                // do 0.35-root of spacing so that the circle explodes outward then
                //  slowly moves into its final position
                points[ k*3 + 0 ] = b.myCenterX + b.myXCircle[k] * ( b.myDiameter + 1.4 * Math.pow( i * 1.0 / b.nCircles, 0.35 ) );
                points[ k*3 + 1 ] = b.myCenterY + b.myYCircle[k] * ( b.myDiameter + 1.4 * Math.pow( i * 1.0 / b.nCircles, 0.35 ) );
                points[ k*3 + 2 ] = 0;
                // color needs alpha
                var colorIntensity = Math.max( 1.0 - Math.pow( i * 1.0 / b.nCircles, 0.45 ), 0.0 );
                setColor( colors, k*4, fftValue, colorIntensity );
            }

            drawLine( gl, points, colors, true );
        }
    }
    

};

function setColor( colors, index, value, intensity )
{
    if( intensity == null )
    {
        intensity = 1.0;
    }
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

    // set alpha
    colors[index + 3] = intensity;
}

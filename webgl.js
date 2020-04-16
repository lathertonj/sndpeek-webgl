/**
 * Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type String is thrown.  The error
 * string contains the compilation or linking error. 
 */
function createProgram(gl, vertexShaderSource, fragmentShaderSource) {
   var vsh = gl.createShader( gl.VERTEX_SHADER );
   gl.shaderSource( vsh, vertexShaderSource );
   gl.compileShader( vsh );
   if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
      throw "Error in vertex shader:  " + gl.getShaderInfoLog(vsh);
   }
   var fsh = gl.createShader( gl.FRAGMENT_SHADER );
   gl.shaderSource( fsh, fragmentShaderSource );
   gl.compileShader( fsh );
   if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
      throw "Error in fragment shader:  " + gl.getShaderInfoLog(fsh);
   }
   var prog = gl.createProgram();
   gl.attachShader( prog, vsh );
   gl.attachShader( prog, fsh );
   gl.linkProgram( prog );
   if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
      throw "Link error in program:  " + gl.getProgramInfoLog(prog);
   }
   return prog;
}


var gl;
var shader_program;
var vertex_buffer;
var color_buffer;
var coord_location;
var color_location;

function initCanvas( canvas )
{
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    vertex_buffer = gl.createBuffer();
    color_buffer = gl.createBuffer();

    // vertex shader source code
    var vertCode = 'attribute vec3 coordinates;'+
       'attribute vec3 color;'+
       'varying vec3 vColor;'+
       'void main(void) {' +
          'gl_Position = vec4(coordinates, 1.0);' +
          'vColor = color;'+
       '}';
    
    // fragment shader source code
    var fragCode = 'precision mediump float;'+
       'varying vec3 vColor;'+
       'void main(void) {'+
          'gl_FragColor = vec4(vColor, 1.);'+
       '}';
    
    shaderProgram = createProgram( gl, vertCode, fragCode );
    gl.useProgram( shaderProgram );
    
    coord_location = gl.getAttribLocation( shaderProgram, "coordinates" );
    color_location = gl.getAttribLocation( shaderProgram, "color" );
    
    // prepare to draw
    // clear color
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 );
    // enable the depth test
    gl.enable( gl.DEPTH_TEST );
    // set the view port
    gl.viewport( 0,0,canvas.width,canvas.height );
    
    return gl;
}

function initFrame( gl )
{
    // Clear the color buffer bit
    gl.clear(gl.COLOR_BUFFER_BIT); 
}

function drawLine( gl, points, colors )
{
    // populate vertex data
    gl.bindBuffer( gl.ARRAY_BUFFER, vertex_buffer );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( points ), gl.DYNAMIC_DRAW );
    gl.vertexAttribPointer( coord_location, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( coord_location );
    
    // populate color data
    gl.bindBuffer( gl.ARRAY_BUFFER, color_buffer );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( colors ), gl.DYNAMIC_DRAW );
    gl.vertexAttribPointer( color_location, 3, gl.FLOAT, true, 0, 0 );
    gl.enableVertexAttribArray( color_location );

    // draw it
    gl.drawArrays( gl.LINE_STRIP, 0, points.length / 3 );
    
}
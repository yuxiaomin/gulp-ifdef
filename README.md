
Inspired by [nino-porcino](https://github.com/nippur72)'s [ifdev-loader](https://github.com/nippur72/ifdef-loader).
gulp-ifdef can process not only js/ts files but also html/less files.

## Installation

Install package with NPM and add it to your development dependencies:

`npm install --save-dev gulp-ifdef`

## Information

<table>
<tr>
<td>Package</td><td>gulp-ifdef</td>
</tr>
<tr>
<td>Description</td>
<td>Conditional compilation</td>
</tr>
<tr>
<td>Node Version</td>
<td>>= 6.0.0</td>
</tr>
</table>

## Usage

gulp-ifdef can delete the source code conditionally according to the condition value in JSON.

Let's say you have below js and html code in src folder

index.js
```js
doSomething()
/// #if DEBUG
outputLog()

function outputLog() {
    // print the debug log to console
}
/// #endif

/// #if version < 2
printVersionWarning();
/// #else
goodToGo();
/// #endif
doSomethingElse();
```

index.html
```html
<div>
    <!-- #if DEBUG -->
    <div>
        The following is log list
    </div>
    <!-- #endif -->
</div>
```

So in you gulpfile

```js
var ifdef = require('gulp-ifdef');

gulp.task('ifdef-copy', function() {
  return gulp.src([
    'src/**/*'
  ], {cwd: './'})
  .pipe(ifdef({
    'DEBUG': true,
    "version": 2
  }, {
    extname: ['js', 'html']
  }))
  .pipe(gulp.dest('./dist'));
}
```

This will conditionally compile the source according to a JSON condition and the ext file name list(this is optinal. if not present then all the files will be processed)

The above index.js and index.html file in the dist folder will change to the following

index.js
```js
doSomething()



goodToGo();

doSomethingElse();
```

index.html
```html
<div>

</div>
```

The files type that are not declared in "extname" will be kept same in the stream.

Now the supported condition syntax is ```///``` (in js/ts/less) or ```<!-- -->``` (in html) 
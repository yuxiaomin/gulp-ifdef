'use strict';

const through = require('through2');
const path = require('path');
const sourceMap = require('source-map');
const applySourceMap = require('vinyl-sourcemaps-apply');

class IfdefParsingError extends Error {
  constructor(message, lines, lineMappings, lineNo) {
    super(`${message} on line ${lineMappings[lineNo] + 1}: ${lines[lineNo]}`);
  }
}

module.exports = function(ifdefOpt, configOpt) {
  ifdefOpt = ifdefOpt || {};
  configOpt = configOpt || {};

  if (configOpt.verbose === undefined) {
    configOpt.verbose = false;
  }

  function bufferContents(file, enc, cb) {
    try {
      // ignore empty files
      if (file.isNull()) {
        cb();
        return;
      }

      // we don't do streams (yet)
      if (file.isStream()) {
        throw new Error('Streaming not supported');
      }

      var extname = path.extname(file.relative).substr(1);
      if(configOpt && configOpt.extname && configOpt.extname.indexOf(extname) != -1) {
        // If the user does not specify the desired behavior, default to inserting
        // blanks when there is no source map and cutting lines when there is.
        let insertBlanks = configOpt.insertBlanks;
        if (insertBlanks === undefined) insertBlanks = !file.sourceMap;

        let parsed = parse(file.contents.toString(), ifdefOpt, configOpt.verbose, insertBlanks);
        file.contents = Buffer.from(parsed.contents, 'utf8');

        if (file.sourceMap) {
          let generator = new sourceMap.SourceMapGenerator({
            file: file.sourceMap.file
          });
          for (let i = 0; i < parsed.lineMappings.length; i++) {
            generator.addMapping({
              source: file.sourceMap.file,
              original: { line: parsed.lineMappings[i] + 1, column: 0 },
              generated: { line: i + 1, column: 0 }
            });
          }
          applySourceMap(file, generator.toString());
        }
      }

      this.push(file);
    } catch (error) {
      this.emit('error', new Error('gulp-ifdef: ' + error.message));
    }

    cb();
  }

  function endStream(cb) {
    cb();
  }

  return through.obj(bufferContents, endStream);
};

var support = {
  "useTripleSlash": {
    ifre: /^[\s]*\/\/\/([\s]*)#(if)([\s\S]+)$/,
    endifre: /^[\s]*\/\/\/([\s]*)#(endif)[\s]*$/,
    elsere: /^[\s]*\/\/\/([\s]*)#(else)[\s]*$/

  },
  "useHTML": {
    ifre: /^[\s]*<!--([\s]*)#(if)([\s\S]+)-->$/,
    endifre: /^[\s]*<!--([\s]*)#(endif)([\s\S]+)-->$/,
    elsere: /^[\s]*<!--([\s]*)#(else)([\s\S]+)-->$/
  }
};

function parse(source, defs, verbose, insertBlanks) {
  const lines = source.split('\n');

  const lineMappings = [];
  for(let i = 0; i < lines.length; i++) {
    lineMappings.push(i);
  }

  const stack = [];
  let ifBlock;
  let match;

  for (let n = 0; n < lines.length; n++) {
    if (match = matchIf(lines[n])) {
      stack.push({
        ifLine: n,
        elseLine: -1,
        endifLine: -1,
        keyword: match.keyword,
        condition: match.condition
      });
    } else if (match = matchElse(lines[n])) {
      ifBlock = stack[stack.length - 1];
      if (!ifBlock) {
        throw new IfdefParsingError('#else outside of #if block', lines, lineMappings, n);
      } else if (ifBlock.elseLine > -1) {
        throw new IfdefParsingError('second #else in #if block', lines, lineMappings, n);
      } else {
        ifBlock.elseLine = n;
      }
    } else if (match = matchEndif(lines[n])) {
      ifBlock = stack.pop();
      if (!ifBlock) {
        throw new IfdefParsingError('#endif outside of #if block', lines, lineMappings, n);
      } else {
        ifBlock.endifLine = n;
        applyIfBlock(lines, lineMappings, ifBlock, defs, insertBlanks);
        n = ifBlock.ifLine - 1;
      }
    }
  }

  if (stack.length > 0) {
    throw new IfdefParsingError('#if without #endif', lines, lineMappings, stack[0].ifLine);
  }

  return {
    contents: lines.join('\n'),
    lineMappings: lineMappings
  };
}

function applyIfBlock(lines, lineMappings, ifBlock, defs, insertBlanks) {
  if (evaluate(ifBlock.condition, ifBlock.keyword, defs)) {
    if (ifBlock.elseLine === -1) {
      removeLines(lines, lineMappings, ifBlock.endifLine, ifBlock.endifLine, insertBlanks);
    } else {
      removeLines(lines, lineMappings, ifBlock.elseLine, ifBlock.endifLine, insertBlanks);
    }
    removeLines(lines, lineMappings, ifBlock.ifLine, ifBlock.ifLine, insertBlanks);
  } else {
    if (ifBlock.elseLine === -1) {
      removeLines(lines, lineMappings, ifBlock.ifLine, ifBlock.endifLine, insertBlanks);
    } else {
      removeLines(lines, lineMappings, ifBlock.endifLine, ifBlock.endifLine, insertBlanks);
      removeLines(lines, lineMappings, ifBlock.ifLine, ifBlock.elseLine, insertBlanks);
    }
  }
}

function matchIf(line) {
  for(let s in support) {
    let re = support[s].ifre;
    const match = String(line).match(re);
    if(match) {
      return {
        startLine: -1,
        keyword: match[2],
        condition: match[3].trim()
     };
    }
  }
  return undefined;
}

function matchEndif(line) {
  for(let s in support) {
    let re = support[s].endifre;
    const match = String(line).match(re);
    if(match) {
      return true;
    }
  }
  return false;
}

function matchElse(line) {
  for(let s in support) {
    let re = support[s].elsere;
    const match = String(line).match(re);
    if(match) {
      return true;
    }
  }
  return false;
}

/**
* @return true if block has to be preserved
*/
function evaluate(condition, keyword, defs) {
  const code = `return (${condition}) ? true : false;`;
  const args = Object.keys(defs);

  let result;
  try {
    const f = new Function(...args, code);
    result = f(...args.map((k) => defs[k]));
     //console.log(`evaluation of (${condition}) === ${result}`);
  } catch(error) {
     throw new Error(`error evaluating #if condition(${condition}): ${error}`);
  }

  if(keyword === "ifndef") {
     result = !result;
  }

  return result;
}

/**
 * Remove line numbers from the lines array, inclusive (so both line "start" and
 * line "end" will be removed, along with all lines in between). If insertBlanks
 * is true, instead of _cutting_ lines, we will replace them with blank lines instead.
 *
 * Typically, it is most useful to remove lines when you have source map support
 * enabled, and to replace them with blank lines if you do not.
 *
 * @param {Array.<string>} lines
 * @param {Array.<number>} lineMappings
 * @param {number} start
 * @param {number} end
 * @param {boolean} insertBlanks
 */
function removeLines(lines, lineMappings, start, end, insertBlanks) {
  if (insertBlanks) {
    for(let t=start; t<=end; t++) {
      const len = lines[t].length;
      const lastChar = lines[t].charAt(len-1);
      const windowsTermination = lastChar === '\r';
      lines[t] = windowsTermination ? '\r' : '';
    }
  } else {
    let cutLength = end - start + 1;
    lines.splice(start, cutLength);
    lineMappings.splice(start, cutLength);
  }
}

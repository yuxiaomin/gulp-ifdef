'use strict';

var through = require('through2');
var path = require('path');
var sourceMap = require('source-map');
var applySourceMap = require('vinyl-sourcemaps-apply');

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
    ifre: /^[\s]*\/\/\/([\s]*)#(if)([\s\S]+)$/g,
    endifre: /^[\s]*\/\/\/([\s]*)#(endif)[\s]*$/g,
    elsere: /^[\s]*\/\/\/([\s]*)#(else)[\s]*$/g

  },
  "useHTML": {
    ifre: /^[\s]*<!--([\s]*)#(if)([\s\S]+)-->$/g,
    endifre: /^[\s]*<!--([\s]*)#(endif)([\s\S]+)-->$/g,
    elsere: /^[\s]*<!--([\s]*)#(else)([\s\S]+)-->$/g
  }
};

function parse(source, defs, verbose, insertBlanks) {
  const lines = source.split('\n');

  const lineMappings = [];
  for(let i = 0; i < lines.length; i++) {
    lineMappings.push(i);
  }

  for(let n=0;;) {
     const ifBlock = get_if_block(lines, n);
     if (!ifBlock) break;

     const cond = evaluate(ifBlock.condition, ifBlock.keyword, defs);

     if(cond) {
        if(verbose) {
           console.log(`matched condition #${ifBlock.keyword} ${ifBlock.condition} => including lines [${ifBlock.startLine+1}-${ifBlock.endLine+1}]`);
        }

        if (ifBlock.elseLine === -1) {
          remove_lines(lines, lineMappings, ifBlock.endLine, ifBlock.endLine, insertBlanks);
        } else {
          remove_lines(lines, lineMappings, ifBlock.elseLine, ifBlock.endLine, insertBlanks);
        }
        remove_lines(lines, lineMappings, ifBlock.startLine, ifBlock.startLine, insertBlanks);
     } else {
        if(verbose) {
           console.log(`not matched condition #${ifBlock.keyword} ${ifBlock.condition} => excluding lines [${ifBlock.startLine+1}-${ifBlock.endLine+1}]`);
        }

        if (ifBlock.elseLine === -1) {
          remove_lines(lines, lineMappings, ifBlock.startLine, ifBlock.endLine, insertBlanks);
        } else {
          remove_lines(lines, lineMappings, ifBlock.endLine, ifBlock.endLine, insertBlanks);
          remove_lines(lines, lineMappings, ifBlock.startLine, ifBlock.elseLine, insertBlanks);
        }
     }

     n = ifBlock.startLine;
  }

  return {
    contents: lines.join('\n'),
    lineMappings: lineMappings
  };
}

function get_if_block(lines, n) {
  let ifBlock = find_start_if(lines, n);
  if (!ifBlock) return;

  let endLine = find_end(lines, ifBlock.startLine);
  if (endLine === -1) {
    throw new Error(`#if without #endif in line ${ifBlock.startLine+1}`);
  } else {
    ifBlock.endLine = endLine;
  }

  let elseLine = find_else(lines, ifBlock.startLine, ifBlock.endLine);
  ifBlock.elseLine = elseLine;

  return ifBlock;
};

function match_if(line) {
  for(var s in support) {
    let re = support[s].ifre;
    const match = re.exec(line);
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

function match_endif(line) {
  for(var s in support) {
    let re = support[s].endifre;
    const match = re.exec(line);
    if(match) {
      return true;
    }
  }
  return false;
}

function match_else(line) {
  for(var s in support) {
    let re = support[s].elsere;
    const match = re.exec(line);
    if(match) {
      return true;
    }
  }
  return false;
}

function find_start_if(lines, n) {
  for(let t=n; t<lines.length; t++) {
     const match = match_if(lines[t]);
     if(match !== undefined) {
        match.startLine = t;
        return match;
        // TODO: when es7 write as: return { line: t, ...match };
     }
  }
  return undefined;
}

function find_end(lines, start) {
  let level = 1;
  for(let t=start+1; t<lines.length; t++) {
     const mif  = match_if(lines[t]);
     const mend = match_endif(lines[t]);

     if(mif) {
        level++;
     }

     if(mend) {
        level--;
        if(level === 0) {
           return t;
        }
     }
  }
  return -1;
}

function find_else(lines, start, end) {
  let level = 1;
  for(let t=start+1; t<end; t++) {
     const mif  = match_if(lines[t]);
     const melse = match_else(lines[t]);
     const mend = match_endif(lines[t]);
     if(mif) {
        level++;
     }

     if(mend) {
        level--;
     }

     if (melse && level === 1) {
        return t;
     }
  }

  return -1;
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
  }
  catch(error) {
     throw new Error(`error evaluation #if condition(${condition}): ${error}`);
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
function remove_lines(lines, lineMappings, start, end, insertBlanks) {
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

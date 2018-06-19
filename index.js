'use strict';

var through = require('through2');
var path = require('path');

module.exports = function(ifdefOpt, configOpt) {
  ifdefOpt = ifdefOpt || {};
  configOpt = configOpt || {};

  function bufferContents(file, enc, cb) {
    // ignore empty files
    if (file.isNull()) {
      cb();
      return;
    }

    // we don't do streams (yet)
    if (file.isStream()) {
      this.emit('error', new Error('gulp-ifdef: Streaming not supported'));
      cb();
      return;
    }

    var extname = path.extname(file.relative).substr(1);
    if(configOpt && configOpt.extname && configOpt.extname.indexOf(extname) != -1) {
      file.contents = Buffer.from(parse(file.contents.toString(), ifdefOpt, true), 'utf8');
    }

    this.push(file);
    
    cb();
  }

  function endStream(cb) {
    console.log("endStream");
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
function parse(source, defs, verbose) {

  const lines = source.split('\n');

  for(let n=0;;) {
     let startInfo = find_start_if(lines,n);
     if(startInfo === undefined) break;

     const endLine = find_end(lines, startInfo.line);
     if(endLine === -1) {
        throw `#if without #endif in line ${startInfo.line+1}`;
     }

     const elseLine = find_else(lines, startInfo.line, endLine);

     const cond = evaluate(startInfo.condition, startInfo.keyword, defs);

     if(cond) {
        if(verbose) {
           console.log(`matched condition #${startInfo.keyword} ${startInfo.condition} => including lines [${startInfo.line+1}-${endLine+1}]`);
        }
        blank_code(lines, startInfo.line, startInfo.line);
        if (elseLine === -1) {
           blank_code(lines, endLine, endLine);
        } else {
           blank_code(lines, elseLine, endLine);
        }
     } else {
        if (elseLine === -1) {
           blank_code(lines, startInfo.line, endLine);
        } else {
           blank_code(lines, startInfo.line, elseLine);
           blank_code(lines, endLine, endLine);
        }
        if(verbose) {
           console.log(`not matched condition #${startInfo.keyword} ${startInfo.condition} => excluding lines [${startInfo.line+1}-${endLine+1}]`);
        }
     }

     n = startInfo.line;
  }

  return lines.join('\n');
}

function match_if(line) {
  for(var s in support) {
    let re = support[s].ifre;
    const match = re.exec(line);
    if(match) {
      return {
        line: -1,
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
        match.line = t;
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
     throw `error evaluation #if condition(${condition}): ${error}`;
  }

  if(keyword === "ifndef") {
     result = !result;
  }

  return result;
}

function blank_code(lines, start, end) {
  for(let t=start; t<=end; t++) {
     const len = lines[t].length;
     const lastChar = lines[t].charAt(len-1);
     const windowsTermination = lastChar === '\r';
     lines[t] = windowsTermination ? '\r' : '';
  }
}
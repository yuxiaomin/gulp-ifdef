'use strict';

const ifdef = require('../index');
const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const fs = require('fs');

describe('gulp-ifdef', function () {
    it('inserts blank lines for blocks that evaluate to false', function (done) {
        gulp.src(['spec/fixtures/simple.js'])
            .pipe(ifdef({ DEBUG: false, A: false }, { extname: ['js'] }))
            .on('data', file => {
                const expected = fs.readFileSync('spec/fixtures/simple.insertBlanks.false.js', 'utf8');
                expect(file.contents.toString()).toEqual(expected);
                done();
            })
            .on('error', error => done(error));
    });

    it('retains blocks that evaluate to true', function (done) {
        gulp.src(['spec/fixtures/simple.js'])
            .pipe(ifdef({ DEBUG: true, A: true }, { extname: ['js'] }))
            .on('data', file => {
                const expected = fs.readFileSync('spec/fixtures/simple.insertBlanks.true.js', 'utf8');
                expect(file.contents.toString()).toEqual(expected);
                done();
            })
            .on('error', error => done(error));
    });

    it('removes lines if insertBlanks is false', function (done) {
        gulp.src(['spec/fixtures/simple.js'])
            .pipe(ifdef({ DEBUG: false, A: false }, { extname: ['js'], insertBlanks: false }))
            .on('data', file => {
                const expected = fs.readFileSync('spec/fixtures/simple.cutLines.js', 'utf8');
                expect(file.contents.toString()).toEqual(expected);
                done();
            })
            .on('error', error => done(error));
    });

    it('updates source map if it exists', function (done) {
        gulp.src(['spec/fixtures/simple.js'])
            .pipe(sourcemaps.init())
            .pipe(ifdef({ DEBUG: false, A: true }, { extname: ['js'] }))
            .pipe(sourcemaps.write())
            .on('data', file => {
                const expected = fs.readFileSync('spec/fixtures/simple.inlineSourceMap.js', 'utf8');
                expect(file.contents.toString()).toEqual(expected);
                done();
            })
            .on('error', error => done(error));
    });

    it('throws an error if an #if block is missing an #endif', function (done) {
        gulp.src(['spec/fixtures/missingEndif.js'])
            .pipe(ifdef({ DEBUG: false, A: false }, { extname: ['js'] }))
            .on('data', file => {
                const expected = fs.readFileSync('spec/fixtures/simple.insertBlanks.false.js', 'utf8');
                expect(file.contents.toString()).toEqual(expected);
                done();
            })
            .on('error', error => {
                expect(String(error)).toEqual('Error: gulp-ifdef: #if without #endif in line 3');
                done();
            });
    });
});

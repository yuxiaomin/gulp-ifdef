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
            .on('data', done.fail)
            .on('error', error => {
                expect(String(error)).toEqual('Error: gulp-ifdef: #if without #endif on line 3:         /// #if A');
                done();
            });
    });

    it('throws an error on unexpected #endif', function (done) {
        gulp.src(['spec/fixtures/doubleEndif.js'])
            .pipe(ifdef({ DEBUG: false, A: false }, { extname: ['js'] }))
            .on('data', done.fail)
            .on('error', error => {
                expect(String(error)).toEqual('Error: gulp-ifdef: #endif outside of #if block on line 5:         /// #endif');
                done();
            });
    });

    it('throws an error on double #else', function (done) {
        gulp.src(['spec/fixtures/doubleElse.js'])
            .pipe(ifdef({ DEBUG: false, A: false }, { extname: ['js'] }))
            .on('data', done.fail)
            .on('error', error => {
                expect(String(error)).toEqual('Error: gulp-ifdef: second #else in #if block on line 7:         /// #else');
                done();
            });
    });

    it('throws an error on unexpected #else', function (done) {
        gulp.src(['spec/fixtures/unexpectedElse.js'])
            .pipe(ifdef({ DEBUG: false, A: false }, { extname: ['js'] }))
            .on('data', done.fail)
            .on('error', error => {
                expect(String(error)).toEqual('Error: gulp-ifdef: #else outside of #if block on line 5:         /// #else');
                done();
            });
    });

    it('throws an error on the correct line when cutting lines', function (done) {
        gulp.src(['spec/fixtures/complexError.js'])
            .pipe(ifdef({ A: false, B: false }, { extname: ['js'], insertBlanks: false }))
            .on('data', result => {
                console.log(result.contents.toString());
                done();
            })
            .on('error', error => {
                expect(String(error)).toEqual('Error: gulp-ifdef: #endif outside of #if block on line 10:         /// #endif');
                done();
            });
    });
});

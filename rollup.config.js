import babel from 'rollup-plugin-babel';
import {terser} from 'rollup-plugin-terser';
import resolve from 'rollup-plugin-node-resolve';

export default [{
    input: 'typeson.js',
    output: {
        file: 'dist/typeson.js',
        format: 'umd',
        name: 'Typeson'
    },
    plugins: [
        babel(),
        terser({
            // Needed for `Typeson.Undefined` and other constructor detection
            keep_fnames: true,
            // Keep in case implementing above as classes
            keep_classnames: true
        })
    ]
}, {
    input: 'typeson.js',
    output: {
        file: 'dist/typeson-commonjs2.js',
        format: 'cjs',
        name: 'Typeson'
    },
    plugins: [
        babel(),
        terser({
            // Needed for `Typeson.Undefined` and other constructor detection
            keep_fnames: true,
            // Keep in case implementing above as classes
            keep_classnames: true
        })
    ]
}, {
    input: 'test/test.js',
    output: {
        file: 'test/test-polyglot.js',
        format: 'umd',
        name: 'TypesonTest'
    },
    plugins: [
        babel(),
        terser({
            // Needed for `Typeson.Undefined` and other constructor detection
            keep_fnames: true,
            // Keep in case implementing above as classes
            keep_classnames: true
        }),
        resolve()
    ]
}];

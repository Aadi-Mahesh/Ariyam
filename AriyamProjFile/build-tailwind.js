const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const tailwindcss = require('@tailwindcss/postcss');
const autoprefixer = require('autoprefixer');

const inputPath = path.resolve(__dirname, 'src', 'input.css');
const outputPath = path.resolve(__dirname, 'src', 'output.css');
const configPath = path.resolve(__dirname, 'tailwind.config.js');

const input = fs.readFileSync(inputPath, 'utf8');

postcss([
  tailwindcss({ config: configPath }),
  autoprefixer(),
])
  .process(input, {
    from: inputPath,
    to: outputPath,
    map: false,
  })
  .then((result) => {
    fs.writeFileSync(outputPath, result.css);
    console.log('Built', outputPath);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

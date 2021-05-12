#!/bin/sh

# Build the module
npm run build

# Copy package.json AND package-lock.json to the commonjs folder
cp package*.json commonjs/

# Also copy the Readme file
cp README.md commonjs

# Go to the directory
cd commonjs

# Install dependencies
npm i

# Publish package
npm publish --scope public

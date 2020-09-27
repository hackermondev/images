/* This file will test images to see if they are corrupted  */
const jimp = require('jimp')

function test(imageData) {
  return new Promise((resolve, reject) => {
    jimp.read(imageData, (err) => {
      if (err) {
        resolve(false)
        return
      }

      resolve(true)
    })

  })
}

module.exports.test = test
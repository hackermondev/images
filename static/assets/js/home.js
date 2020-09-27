var form = document.getElementById('form')

var image = document.getElementById('file')

image.addEventListener('change', ()=>{
  form.submit()
})

function upload(){
  image.click()
}

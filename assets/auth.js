const GALLERY_PASSWORD = "diaper";
function requireLogin(){
  if(sessionStorage.getItem("secureGalleryLoggedIn")!=="true"){
    location.replace("index.html");
    return false;
  }
  sessionStorage.removeItem("secureGalleryLoggedIn");
  return true;
}
function setupLogin(){
  const form=document.getElementById("loginForm");
  const input=document.getElementById("password");
  const error=document.getElementById("loginError");
  form.addEventListener("submit",event=>{
    event.preventDefault();
    if(input.value===GALLERY_PASSWORD){
      sessionStorage.setItem("secureGalleryLoggedIn","true");
      location.replace("images.html");
    }else{
      error.textContent="Wrong password";
      input.value="";
      input.focus();
    }
  });
}
function setupLogout(){
  const button=document.getElementById("logout");
  if(button)button.addEventListener("click",()=>{
    sessionStorage.removeItem("secureGalleryLoggedIn");
    location.replace("index.html");
  });
}
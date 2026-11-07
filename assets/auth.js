const GALLERY_PASSWORD = "diaper";
function requireLogin(){
  const allowed=sessionStorage.getItem("secureGalleryLoggedIn")==="true";
  sessionStorage.removeItem("secureGalleryLoggedIn");
  if(!allowed){
    document.documentElement.style.display="none";
    if(window.top!==window)window.top.location.replace(new URL("./",window.location.href).href);
    else location.replace("index.html");
    return false;
  }
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
      if(typeof showGallery==="function"){
        showGallery();
      }else{
        location.replace("index.html");
      }
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
    if(window.top!==window){
      window.top.location.replace("index.html");
    }else{
      location.replace(new URL("./",window.location.href).href);
    }
  });
}

const io = new IntersectionObserver(es => {
  es.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold:.1, rootMargin:'0px 0px -40px' });
document.querySelectorAll('.rv').forEach(el => io.observe(el));

/* ---------- hero video mute toggle ---------- */
const heroVideo = document.getElementById('heroVideo');
const muteBtn = document.getElementById('muteBtn');
if(heroVideo && muteBtn){
  muteBtn.onclick = () => {
    heroVideo.muted = !heroVideo.muted;
    muteBtn.dataset.muted = heroVideo.muted;
    muteBtn.setAttribute('aria-label', heroVideo.muted ? 'Unmute video' : 'Mute video');
  };
}

/* ---------- mobile menu: close after a link is tapped ---------- */
const mobileMenu = document.getElementById('mobileMenu');
if(mobileMenu){
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.open = false));
}

/* ---------- splash: plays once per browser session, skipped if the
   visitor has already seen it on an earlier page this visit ---------- */
if(sessionStorage.getItem('vetriver_splash_seen')){
  document.body.classList.add('no-splash');
} else {
  sessionStorage.setItem('vetriver_splash_seen', '1');
  const splash = document.querySelector('.splash');
  if(splash) splash.addEventListener('animationend', e => {
    if(e.animationName === 'splash-out') splash.remove();
  });
}

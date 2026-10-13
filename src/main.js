import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')

// offline support and install to the home screen (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
  })
}

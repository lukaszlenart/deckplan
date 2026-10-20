import { render } from 'preact'
import { App } from './ui/App'
import './styles/app.css'

const root = document.getElementById('app')
if (root) render(<App />, root)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('./sw.js')
}

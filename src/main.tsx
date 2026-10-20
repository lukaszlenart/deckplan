import { render } from 'preact'
import { App } from './ui/App'
import './styles/app.css'
import './styles/print.css'

const root = document.getElementById('app')
if (root) render(<App />, root)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('./sw.js')
}

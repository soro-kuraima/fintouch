import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { Card, CardHeader, CardTitle } from './components/ui/card'

function App() {
  const [count, setCount] = useState(0)

  return (
   <div className='text-3xl font-bold underline'>
    <div className='h-50 m-8 bg-primary'><span className='text-primary-foreground'>Hello World </span></div>
    <div className='h-50 m-8 bg-secondary'><span className='text-secondary-foreground'>Hello World </span></div>
    <div className='h-50 m-8 bg-tertiary'><span className='text-tertiary-foreground'>Hello World </span></div>
    <div className='h-50 m-8 bg-accent claymorphic'><span className='text-accent-foreground'>Hello World </span></div>
    <div className='h-50 m-8 bg-background'><span className='text-background-foreground'>Hello World </span></div>
    <div className='h-50 m-8 bg-border'><span className='text-border-foreground'>Hello World </span></div>
    <div className='h-50 m-8 bg-input'><span className='text-input-foreground'>Hello World </span></div>
    <div className='h-50 m-8 bg-ring'><span className='text-ring-foreground'>Hello World </span></div>
    <div className='h-50 m-8 bg-card'><span className='text-card-foreground'>Hello World </span></div>
    <div className='h-50 m-8 bg-popover'><span className='text-popover-foreground'>Hello World </span></div>
    <div className='h-50 m-8 bg-muted'><span className='text-muted-foreground'>Hello World </span></div>
    <div className='h-50 m-8 bg-muted'><span className='text-muted-foreground'>Hello World </span></div>
    <Card className='card-clay'>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
      </CardHeader>
    </Card> 
   </div>
  )
}

export default App

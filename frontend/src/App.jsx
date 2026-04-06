import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom"; // Import these
import Visual from './components/visual.jsx'
import {useState} from "react";

function App() {

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Visual/>} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
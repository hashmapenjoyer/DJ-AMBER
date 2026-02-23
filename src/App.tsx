import './App.css';
import NavBar from './components/NavBar';
import MusicLibrary from './components/MusicLibrary';
import NowPlaying from './components/NowPlaying';
import SetList from './components/SetList';
import Timeline from './components/Timeline';

function App() {
  return (
    <div className="app-container">
      <NavBar />
      <div className="middle-section">
        <MusicLibrary />
        <NowPlaying />
        <SetList />
      </div>
      <Timeline />
    </div>
  );
}

export default App;

import { PokerTable } from '../components/PokerTable';
import { Sidebar } from '../components/Sidebar';
import { GameControls } from '../components/GameControls';

export function HomePage() {
  return (
    <div className="h-screen flex bg-[#0a0e13]">
      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Controls */}
        <GameControls />

        {/* Table Area */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          <PokerTable />
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 flex-shrink-0">
        <Sidebar />
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";

// Suits and Ranks
const SUITS = ["S","H","D","C"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

// Make Deck
function makeDeck() {
  const deck = [];
  SUITS.forEach(s => RANKS.forEach(r => deck.push({ suit: s, rank: r, id: `${r}${s}` })));
  return deck;
}

// Shuffle deck
function shuffle(arr) {
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Card value for AI evaluation
function cardValue(card){
  return RANKS.indexOf(card.rank);
}

// AI chooses bid
function aiChooseBid(hand, defaultCall){
  const highCount = hand.filter(c=>["A","K","Q","J","10"].includes(c.rank)).length;
  const spadesCount = hand.filter(c=>c.suit==="S").length;
  let estimate = Math.floor((highCount + spadesCount)/2);
  estimate = Math.max(estimate, defaultCall);
  return Math.min(13, estimate);
}

// AI chooses trump
function aiChooseTrump(hand){
  const scores = {};
  SUITS.forEach(s=>scores[s]=0);
  hand.forEach(c=>{
    const val = cardValue(c);
    scores[c.suit] += val >= 8 ? 3 : val >= 5 ? 2 : 1;
  });
  return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
}

// Legal cards for play (follow suit if possible)
function legalCards(hand, leadSuit) {
  if(!leadSuit) return hand.slice();
  const follow = hand.filter(c => c.suit === leadSuit);
  return follow.length ? follow : hand.slice();
}

// Card images
function getCardImage(card){
  const rankMap = {"A":"ace","K":"king","Q":"queen","J":"jack","10":"10","9":"9","8":"8","7":"7","6":"6","5":"5","4":"4","3":"3","2":"2"};
  const suitMap = {"S":"spades","H":"hearts","D":"diamonds","C":"clubs"};
  return `/assets/${rankMap[card.rank]}_of_${suitMap[card.suit]}.png`;
}

// Back image
const backImg = "/assets/back.png";

export default function App() {
  const [players] = useState(Array.from({length:4},(_,i)=>({id:i,name:i===0?'You':`AI ${i}`,ai:i!==0})));
  const [hands,setHands] = useState({});
  const [phase,setPhase] = useState("lobby");
  const [bids,setBids] = useState({});
  const [trump,setTrump] = useState(null);
  const [currentPlayer,setCurrentPlayer] = useState(0);
  const [trick,setTrick] = useState([]);
  const [leadSuit,setLeadSuit] = useState(null);
  const [logs,setLogs] = useState([]);
  const [scores,setScores] = useState({teamA:0, teamB:0});
  const [playerBid, setPlayerBid] = useState(null);
  const [playerTrump, setPlayerTrump] = useState(null);

  const log = t=>setLogs(l=>[t,...l].slice(0,50));

  let fullDeck = shuffle(makeDeck());

  // Deal 5 cards for initial bidding
  function dealFiveCards() {
    const handsLocal = {};
    for(let i=0;i<4;i++){
      handsLocal[i] = fullDeck.slice(i*5, i*5+5);
    }
    setHands(handsLocal);
    setPhase("bidding");
    log("5 cards dealt to all players for bidding");
  }

  // Deal remaining cards (8 per player)
  function dealRemainingCards() {
    const handsLocal = {...hands};
    for(let i=0;i<4;i++){
      const currentIds = handsLocal[i].map(c=>c.id);
      handsLocal[i] = [...handsLocal[i], ...fullDeck.filter(c=>!currentIds.includes(c.id)).slice(i*8,i*8+8)];
    }
    setHands(handsLocal);
    log("Remaining 8 cards dealt, full hands ready");
  }

  // Run bidding (after player bids)
  function runBidding(playerBid) {
    setPlayerBid(playerBid);
    const bidsLocal = {0: playerBid};
    for(let p=1;p<4;p++){
      bidsLocal[p] = aiChooseBid(hands[p], 5);
      log(`AI ${p} bids ${bidsLocal[p]}`);
    }
    setBids(bidsLocal);
    // Determine high bidder
    const high = Object.entries(bidsLocal).reduce((best,[pid,v])=>!best||v>best.val?{pid:Number(pid),val:v}:best,null);
    if(high){
      if(high.pid === 0){
        setPhase("trumpSelect"); // player selects trump
        log("You won the bid! Select trump suit.");
      } else {
        const chosen = aiChooseTrump(hands[high.pid]);
        setTrump({player: high.pid, bid: high.val, trump: chosen});
        log(`AI ${high.pid} won bidding and sets trump ${chosen}`);
        dealRemainingCards();
        setPhase("play");
        setCurrentPlayer(high.pid);
      }
    }
  }

  // Player selects trump
  function selectTrump(suit) {
    setTrump({player:0,bid:playerBid,trump:suit});
    log(`You selected trump: ${suit}`);
    dealRemainingCards();
    setPhase("play");
  }

  // AI plays card
  function aiPlayTurn(){
    const hand = hands[currentPlayer];
    const card = legalCards(hand,leadSuit)[0];
    playCard(currentPlayer, card);
  }

  // Play card
  function playCard(pid, card){
    setHands(prev=>({...prev,[pid]:prev[pid].filter(c=>c.id!==card.id)}));
    setTrick(t=>{
      const newTrick = [...t, {player:pid,card}];
      if(newTrick.length===1) setLeadSuit(card.suit);

      if(newTrick.length===4){
        const trumpSuit = trump.trump;
        let best = newTrick[0];

        newTrick.forEach(play=>{
          if(play.card.suit === trumpSuit && best.card.suit !== trumpSuit){
            best = play;
          } else if(play.card.suit === best.card.suit && cardValue(play.card) > cardValue(best.card)){
            best = play;
          }
        });

        const team = best.player %2 ===0 ? 'teamA':'teamB';
        setScores(s=>({...s,[team]:s[team]+1}));

        newTrick.forEach(p=>{
          log(`${p.player===0?'You':'AI '+p.player} played ${p.card.rank} of ${p.card.suit}`);
        });

        setTrick([]);
        setLeadSuit(null);
        setCurrentPlayer(best.player);
      } else setCurrentPlayer((pid+1)%4);

      return newTrick;
    });
  }

  useEffect(()=>{
    if(phase==='play' && players[currentPlayer].ai){
      const legal = legalCards(hands[currentPlayer], leadSuit);
      setTimeout(()=>playCard(currentPlayer, legal[0]),1200);
    }
  },[currentPlayer,phase]);

  return (
    <div className="min-h-screen bg-green-900 flex flex-col items-center justify-between p-4">

      {/* Lobby */}
      {phase==='lobby' &&
        <button className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded shadow-lg text-2xl" onClick={dealFiveCards}>
          Start Round
        </button>
      }

      {/* Bidding */}
      {phase==='bidding' &&
        <div className="flex flex-col items-center gap-8 mt-6">
          <h2 className="text-white text-3xl font-bold">Bidding Phase</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            {[...Array(9)].map((_,i)=>
              <button key={i} className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded" onClick={()=>runBidding(i+5)}>
                {i+5}
              </button>
            )}
          </div>
          <div className="text-white mt-4">
            {Object.entries(bids).map(([pid,v])=><div key={pid}>{pid==0?'You':`AI ${pid}`} bid: {v}</div>)}
          </div>
        </div>
      }

      {/* Trump selection */}
      {phase==='trumpSelect' &&
        <div className="flex flex-col items-center gap-4 mt-6">
          <h2 className="text-white text-3xl font-bold">Select Trump</h2>
          <div className="flex gap-4">
            {SUITS.map(s=>
              <button key={s} className="bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded" onClick={()=>selectTrump(s)}>
                {s}
              </button>
            )}
          </div>
        </div>
      }

      {/* Play Phase */}
      {phase==='play' &&
        <div className="relative w-full flex flex-col items-center gap-8">

          <div className="text-white text-2xl font-bold mb-2">Trump: {trump.trump} | Scores - Team A: {scores.teamA} Team B: {scores.teamB}</div>

          {/* Round table AI top */}
          <div className="flex justify-center gap-6 mt-2">
            {hands[1]?.map((_,i)=><img key={i} src={backImg} className="w-20 h-28 rounded shadow-lg" alt="AI Card"/>)}
          </div>

          {/* Trick cards */}
          <div className="relative w-full flex justify-center items-center h-48">
            {trick.map((t,i)=>(
              <img key={t.card.id} src={getCardImage(t.card)} className="w-28 h-40 rounded shadow-2xl absolute transition-transform duration-700" style={{transform:`translate(${(i-1.5)*80}px,0)`}}/>
            ))}
          </div>

          {/* AI left/right */}
          <div className="flex justify-between w-full px-20 mt-8">
            <div className="flex flex-col items-center gap-2">{hands[3]?.map((_,i)=><img key={i} src={backImg} className="w-20 h-28 rounded shadow-lg" alt="AI Card"/>)}</div>
            <div className="flex flex-col items-center gap-2">{hands[2]?.map((_,i)=><img key={i} src={backImg} className="w-20 h-28 rounded shadow-lg" alt="AI Card"/>)}</div>
          </div>

          {/* Player hand fanned */}
          <div className="flex gap-4 mt-8 justify-center relative">
            {hands[0]?.map((c,i)=>{
              const legal = legalCards(hands[0], leadSuit);
              const isLegal = legal.some(lc=>lc.id===c.id);
              return (
                <img key={c.id} src={getCardImage(c)} className={`w-28 h-40 cursor-pointer transform hover:scale-110 transition-all duration-300 ${isLegal?'':'opacity-40 pointer-events-none'}`} 
                  style={{transform:`rotate(${i*4-24}deg)`}}
                  onClick={()=>isLegal && playCard(0,c)}
                  alt={c.id}/>
              )
            })}
          </div>
        </div>
      }

      {/* Logs */}
      <div className="mt-6 max-h-48 overflow-auto text-white p-4 bg-black/40 w-full rounded shadow-inner">
        <h3 className="font-bold mb-2 text-lg">Logs:</h3>
        {logs.map((l,i)=><div key={i}>{l}</div>)}
      </div>
    </div>
  );
}

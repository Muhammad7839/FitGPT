import { useEffect, useMemo, useState } from 'react';


function formatToday(){
    return new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

export default function Dashboard(){
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('fitgpt-theme') || 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('fitgpt-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    //Mock data for now (fetch with FastAPI later)
    const[weather] = useState({
        label: "Today's Weather",
        condition: 'Partly Cloudy',
        tempF: 68,
    });


    const [context] = useState({
        occasion: 'Casual',
    });

    const [recommendation, setRecommendation] = useState([
        {id: '1', name: 'Navy Cardigan'},
        {id: '2', name: "Cropped White T-Shirt"},
        {id: '3', name: "Grey Baggy Denim Jeans"},
        {id: '4', name: "Black Tabi"}
    ]);

    const [explanations] = useState({
        why: 'Casual streetwear for a day spent in the city',
        bodyType: 'The cropped t-shirt and baggy jeans complement your proportions...'
    });

    //new suggestions mock logic (swap names around)
    const suggestionsPool = useMemo(
        () => [

            ['Oversized Graphic Hoodie', 'White Tee', 'Distressed Denim', 'Air Force 1s'],
            ['Varsity Jacket', 'Neutral Hoodie', 'Cargo Pants', 'New Balance 550s'],
            ['Puffer Jacket', 'Crewneck Sweatshirt', 'Tech Joggers', 'Yeezy Boost 350s']
        ], 
        []
    );

    const handleAnotherSuggestion = () => {
        const pick = suggestionsPool[Math.floor(Math.random() * suggestionsPool.length)];
        setRecommendation([
            {id: '1', name: pick[0]},
            {id: '2', name: pick[1]},
            {id: '3', name: pick[2]},
            {id: '4', name: pick[3]}
        ]);
    };

    return(
        <div className="page">
            {/*Top bar */}
            <header className="topbar">
                <div className="brand">
                    <div className="logo">FG</div>
                    <div className="brandName">FitGPT</div>
                </div>
                <div className="topRight">
                    <div className="dateText">{formatToday()}</div>
                    <button className="themeToggle" onClick={toggleTheme} title="Toggle theme">
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                </div>

            </header>

            <main className="content">
                {/*Weather card*/}
                <section className="card weatherCard">
                    <div className="weatherLeft">
                        <div className="muted">{weather.label}</div>
                        <div className="weatherMain">
                            <strong>{weather.condition}</strong>, {weather.tempF}°F
                        </div>
                    </div>
                    <div className="weatherIcon" aria-label="Weather Icon">☁️</div>
                </section>

                {/*Recommendation card*/}
                <section className='card recCard'>
                    <div className='recHeader'>
                        <div className='recTitle'>
                            <span className='sparkle'>✦</span> Today&apos;s Recommendation
                        </div>
                        <div className='chip'>{context.occasion}</div>
                    </div>

                    <div className="outfitGrid">
                        {recommendation.map((item) => (
                        <div key={item.id} className="outfitItem">
                            <div className="thumb" />
                            <div className="itemName">{item.name}</div>
                        </div>
                    ))}
                    </div>

                    <div className='divider' />

                    {/*Explanation sections */}
                    <div className='explainBlock'>
                        <div className='explainTitle'>
                            <span className='sparkle'>✦</span>Why This Outfit?
                        </div>
                        <div className='explainText'>{explanations.why}</div>
                    </div>

                    <div className="divider" />

                    <div className='explainBlock'>
                        <div className='explainTitle green'>
                            <span className='sparkle'>✦</span>Tailored to Your Body Type
                        </div>
                        <div className='explainText'>{explanations.bodyType}</div>
                    </div>

                    {/*Buttons row*/}
                    <div className="actionsRow">
                        <button className="primaryBtn" onClick={handleAnotherSuggestion}>
                        ⟳ Get Another Suggestion 
                        </button>

                        <button className="iconBtn" title="Favorite">
                            ♡
                        </button>

                        <button className="iconBtn" title="Share">
                        ↗ 
                        </button>
                    </div>
                </section>

                {/*Quick Actions */}
                <section className='card quickCard'>
                    <div className='sectionTitle'>Quick Actions</div>

                    <button className='quickAction'>
                        <div className='quickTitle'>Plan Tomorrow&apos;s Outfit</div>
                        <div className='muted'>Get ahead of your schedule</div>
                    </button>

                    <button className='quickAction'>
                        <div className='quickTitle'>Browse Past Outfits</div>
                        <div className="muted">See what you&apos;ve worn recently</div>
                    </button>
                </section>
            </main>

            {/* Bottom Navigation  */}
            <nav className="bottomNav">
                <NavItem label="Today" active />
                <NavItem label="Wardrobe" />
                <NavItem label="Favorites" />
                <NavItem label="Profile" />
            </nav>
        </div>
    );
}

function NavItem({label, active = false}){
    return(
        <button className={`navItem ${active ? 'active' : ''}`}> 
            <div className="navIcon">{label === 'Today' ? '⌂' : '•'}</div>
            <div className="navLabel">{label}</div>
        </button>         
    );
}
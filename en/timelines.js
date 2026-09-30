/* ============================================================
 * 道路以目 · 历史时间线
 * 每一关几乎每一轮都有一条"当日要闻"; 许多条会真实地推动局势
 * (带出人群、加深积怨、动摇执行者、推高当局警觉……)。
 * 史实尽量准确; 标为"据报道/据传"的, 来源本身就不确定。
 * 没有具体史料的日子, 用的是那个时代的日常景象, 而不是编造的事件。
 * ============================================================ */
(function (global) {
  'use strict';
  const TL = {};
  const H = (at, headline, run, kind, cond) => ({ at, headline, run, kind: kind || 'event', if: cond });

  /* ---------------- 厉王弭谤 (每轮一个月) ---------------- */
  TL.liwang = [
    H(1, "Duke Rong sent men to seal off the mountains: woodcutters may no longer go up to cut firewood.", (g) => g.griefAll(0.008)),
    H(3, "A wooden sign went up by the marshes: no fisherman may cast a net, on pain of punishment.", (g) => g.griefAll(0.008)),
    H(4, "In the market someone started singing a new ballad. It went: “The people are weary indeed.”"),
    H(5, (g) => (g.pol.enforce === 'harsh' || g.pol.enforce === 'terror') ? "Men of the shaman of Wei are mingling in the market. Fewer and fewer people speak." : "The talk in the market has not died down."),
    H(6, "Spring plowing. In the well-fields people bend over their work. No one speaks."),
    H(7, "A great officer said in private: “The royal house is surely headed for a fall!”"),
    H(8, "A new ban was posted at the city gate. Someone tore it down.", (g) => g.addSeeds(0.006)),
    H(11, "A line has appeared in a song people are singing: “High Heaven has turned perverse; the people below are all in distress.”"),
    H(12, "New Year sacrifices. In the ancestral temple, the king prayed for Heaven's mandate to last."),
    H(13, "The capital's people have begun greeting one another with only their eyes.", (g) => g.griefAll(0.005)),
    H(14, "In the night, someone pushed over a “royal monopoly” sign.", (g) => g.addSeeds(0.008)),
    H(16, "Grumbling among the guards: the people they arrest are their own neighbors and kin.", (g) => g.scalePsi(0.15, 0.9), 'army'),
    H(17, "“Vast is High Heaven, sovereign of the people below.” — this poem is passing among the nobles."),
    H(18, "Autumn harvest. The royal granaries are full; the grain jars of the capital's people are running low.", (g) => g.griefAll(0.01)),
    H(22, "At the well, someone murmured, “If this goes on…” — then saw a guard and walked away."),
    H(24, "Another year. The king is in fine spirits: there really is less talk."),
    H(26, "An old firewood seller was taken away. All he did was grumble once.", (g) => g.griefAll(0.01)),
    H(28, "Young people in the capital have started meeting at night.", (g) => { g.org = Math.min(100, g.org + 6); }),
    H(31, (g) => g.meanGrievance() / g.moodScale > 0.5 ? "People on the road glance at one another. Each is waiting for someone else to speak first." : "There is laughter in the market again."),
    H(33, "A rumor: the country folk beyond the walls are talking too.", (g) => { g.org = Math.min(100, g.org + 5); }),
    H(35, "Winter of the third year."),
  ];

  /* ---------------- 彼得格勒 1917 (每轮半天, 俄历) ---------------- */
  TL.petrograd = [
    H(0, "The Duma opened. Tens of thousands of workers struck, echoing the deputies' speeches.", (g) => g.addSeeds(0.008)),
    H(2, "The bread line outside the bakery stretches around the corner. Twenty degrees below zero."),
    H(4, "The papers say: grain can't reach the capital because of the snow and the railways."),
    H(6, "Talk in the factories: how many more have died at the front."),
    H(10, "Rumor: bread rationing from March 1. People queued outside the bakeries all night.", (g) => g.griefAll(0.015)),
    H(12, "On the Vyborg side, someone smashed a bakery window.", (g) => g.addSeeds(0.006)),
    H(14, "Factory owners complain: the workers say not a word, and work slower and slower."),
    H(16, "The Tsar left the capital for army headquarters at the front.", (g) => g.addAlert(-5)),
    H(20, (g) => g.x > 0.03 ? "Over 200,000 on strike. On Nevsky Prospect, the Cossacks did not charge the crowd." : "The workers are still wavering. Cossacks patrol the streets.", (g) => g.scalePsi(0.12, 0.8), 'army'),
    H(21, "At night, lights burn late in the workers' districts."),
    H(23, "Znamenskaya Square: a Cossack cut down a police officer who was beating demonstrators. The news spread through the city all night.", (g) => g.scalePsi(0.15, 0.8), 'army'),
    H(25, "The 4th Company of the Pavlovsky Regiment mutinied, fired on mounted police, and was then disarmed. Duma Chairman Rodzianko wired the Tsar urgently; the Tsar ignored him.", (g) => g.scalePsi(0.15, 0.7), 'army'),
    H(27, (g) => g.d > 0.3 ? "Soldiers threw open the Kresty prison. In the Tauride Palace, the Petrograd Soviet was formed." : "The shooting in the city goes on and on."),
    H(28, "General Khabalov's last loyal troops are holed up in the Admiralty.", null, 'army'),
    H(30, "The sailors at Kronstadt have risen too.", (g) => g.scalePsi(0.1, 0.7), 'army'),
  ];

  /* ---------------- 伊朗 1978 (每轮一周) ---------------- */
  TL.iran = [
    H(1, "The government says: the Qom “rioters” are manipulated by foreign powers.", (g) => g.griefAll(0.01)),
    H(2, "From exile in Najaf, Iraq, Khomeini called for the mourning to continue. Cassette tapes began passing from mosque to mosque."),
    H(4, "The bazaar shut for a day for the dead of Qom.", (g) => g.addSeeds(0.006)),
    H(7, "The army crushed the riots in Tabriz. The Shah replaced the local officials."),
    H(9, "SAVAK (the secret police) came knocking at night."),
    H(11, "Yazd: at the fortieth-day mourning for the dead of Tabriz, more people fell."),
    H(14, "University students in Tehran went on strike."),
    H(17, "Qom: police burst into the home of the moderate cleric Shariatmadari and killed students of his.", (g) => g.griefAll(0.015)),
    H(20, "The Shah in an interview: “Nobody can overthrow me. I have 700,000 troops.”"),
    H(24, "Summer. For the first time, the cycle of mourning slowed."),
    H(28, "Mashhad: mourners clashed with the security forces.", (g) => g.addSeeds(0.008)),
    H(30, "On Constitution Day, the Shah promised: free elections next year.", (g) => g.griefScale(0.95)),
    H(31, "Martial law in Isfahan.", null, 'opp'),
    H(33, "The Shah brought in a “national reconciliation” cabinet: casinos closed, the Islamic calendar restored.", (g) => g.griefScale(0.95)),
    H(34, "Eid al-Fitr: hundreds of thousands marched through the streets of Tehran.", (g) => g.addSeeds(0.02)),
    H(35, "President Carter phoned the Shah to voice his support."),
    H(36, "A great earthquake at Tabas killed more than 10,000. Relief organized by the mosques arrived faster than the government's.", (g) => g.griefAll(0.01)),
    H(38, "Expelled from Iraq, Khomeini moved to the outskirts of Paris. Every day his speeches reached Iran by radio and taped telephone calls.", (g) => { g.base.globalScale = Math.min(1, g.base.globalScale + 0.08); }),
    H(41, "Bank clerks, civil servants and newspaper journalists went on strike too.", (g) => g.addSeeds(0.01)),
    H(43, "Tehran: banks, cinemas and bars were set on fire. On television the Shah said, “I have heard the voice of your revolution.” Then he appointed a military government.", (g) => { g.griefScale(0.95); g.addAlert(10); }, 'opp'),
    H(45, "After curfew, people climbed onto the rooftops and shouted together: “Allahu akbar!”", (g) => g.griefAll(0.01)),
    H(47, "The month of Muharram began.", (g) => g.giveFree('memorial', 2)),
    H(50, "More and more soldiers were deserting.", (g) => g.scalePsi(0.2, 0.8), 'army'),
    H(51, "The Shah appointed Bakhtiar prime minister."),
    H(55, "Khomeini returned to Tehran. Millions poured into the streets to greet him.", (g) => g.addSeeds(0.05)),
    H(56, "Air force technicians at Doshan Tappeh air base rose up and fought the Imperial Guard.", (g) => g.scalePsi(0.35, 0.5), 'army'),
  ];

  /* ---------------- 波兰 1981—1982 (每轮一周, 玩家是当局) ---------------- */
  TL.poland = [
    H(1, "Tanks broke the strike at the Lenin Shipyard in Gdańsk.", (g) => g.griefAll(0.008)),
    H(2, "Christmas Eve. Many families set candles in their windows. In Silesia, miners were still on strike underground.", (g) => { g.org += 5; }),
    H(3, "The phones are back — with a recording on the line: “This call is being monitored.”"),
    H(5, "Schools reopened. The curfew stayed."),
    H(7, "From February 1, food prices rose by 200 to 400 percent.", (g) => g.griefAll(0.02)),
    H(8, "When the official news came on at 7:30 each evening, some switched off the TV and went out walking with the whole family.", (g) => { g.org += 4; }),
    H(11, "Internees in the camps began writing letters. Some were intercepted."),
    H(14, "The Church called for reconciliation. The bishops demanded the release of the internees.", (g) => { g.org += 3; }),
    H(17, "The underground station “Radio Solidarity” began broadcasting in Warsaw.", (g) => { g.org += 6; }),
    H(21, "May 13: five months of martial law. Across the country, people sounded horns and stopped work for fifteen minutes.", (g) => g.addSeeds(0.008)),
    H(24, "Underground papers passed from hand to hand in the factories, in larger print runs than before martial law.", (g) => { g.org += 4; }),
    H(28, "Summer. The lines for meat are longer than last year.", (g) => g.griefAll(0.01)),
    H(31, "July 22: some internees released; some martial-law restrictions eased.", (g) => { const s = g.sim; for (let i = 0; i < s.o.N; i++) if (s.r[i] && s.rng() < 0.25) s.r[i] = 0; s.tauDirty = true; }),
    H(35, "Underground Solidarity's call: take to the streets nationwide on August 31.", (g) => { g.org += 10; }, 'opp'),
    { at: 38, title: "Lubin", art: '⚫', text: "News from Lubin, in Silesia: at the August 31 demonstration, riot police (ZOMO) opened fire. Three dead.", choices: [
      { label: "Public inquiry, punish shooters", hint: "The line people accept ↑ · Opposition organization −10 · Enforcers slightly disgruntled", run: (g) => { g.base.Pbar += 0.05; g.org = Math.max(0, g.org - 10); g.scalePsi(0.3, 0.9); } },
      { label: "Call it self-defense", hint: "Grievance rising · Opposition organization +8", run: (g) => { g.griefAll(0.025); g.org += 8; } },
    ] },
    H(40, "One by one, the internment camps closed. Some internees were sentenced; others were “advised” to emigrate."),
    H(43, "Gdańsk shipyard workers struck against the banning of Solidarity. The shipyard was promptly placed under military control.", (g) => g.addSeeds(0.012), 'crowd'),
  ];

  /* ---------------- 北京 1989 (每轮一天) ---------------- */
  TL.beijing = [
    H(2, "Students from Peking University and the China University of Political Science and Law marched to Tiananmen Square carrying wreaths.", (g) => g.addSeeds(0.01)),
    H(3, "Students staged a sit-in outside the Great Hall of the People with seven demands: rehabilitate Hu Yaobang, press freedom, disclose leaders' incomes…"),
    H(5, "At Xinhua Gate, police broke up a student sit-in. Some were beaten and hurt. Word spread across the campuses.", (g) => g.griefAll(0.015)),
    H(6, "On the eve of the memorial service, 100,000 students got into the Square before it was sealed off and sat there all night.", (g) => g.addSeeds(0.02)),
    H(7, "Rioting and looting broke out in Xi'an and Changsha. State media reported them in the same breath as the student movement.", null, 'opp'),
    H(8, "Students organized across campuses: the Beijing Students' Autonomous Federation was founded.", (g) => g.addEdgesFrac && g.addEdgesFrac(0.1)),
    H(9, "Beijing's university students began a class boycott."),
    H(14, "State Council spokesman Yuan Mu held a “dialogue” with some students. The students said it wasn't a dialogue; it was a lecture.", (g) => g.griefAll(0.01)),
    H(19, "Speaking at the Asian Development Bank's annual meeting, Zhao Ziyang said the students were “by no means opposed to our fundamental system.”", (g) => g.addAlert(-12)),
    H(22, "Students drifted back to class. The Square was quiet for a few days."),
    H(24, "More than a thousand journalists signed a petition demanding press freedom.", (g) => { g.base.globalScale = Math.min(1, g.base.globalScale + 0.05); }),
    H(25, "Over ten thousand students rode bicycles around the city in support of the journalists.", (g) => g.addSeeds(0.01)),
    H(29, "Yan Mingfu, head of the United Front Work Department, came to the Square to talk with the hunger strikers and urge them to leave. The talks broke down."),
    H(31, "Zhao Ziyang told Gorbachev: on the most important questions, Comrade Deng Xiaoping is still needed at the helm. The whole world understood what that meant.", (g) => g.griefAll(0.01)),
    H(32, "Over a million people took to the streets: workers, government cadres, schoolteachers — even people in police uniform.", (g) => g.addSeeds(0.05), 'crowd'),
    H(33, "Li Peng met student representatives in the Great Hall of the People. Wu'er Kaixi, in hospital pajamas, cut him off. It went out live on TV and ended in acrimony.", (g) => g.griefAll(0.01)),
    H(36, "Martial law, day one. Army trucks were blocked at the edge of the city. Old women brought the soldiers steamed buns; students explained why people had taken to the streets.", (g) => g.scalePsi(0.15, 0.85), 'army'),
    H(37, "Liuliqiao, Gongzhufen: convoys stalled on the roads; soldiers sat on the truck roofs, talking with the residents crowded around them.", (g) => g.scalePsi(0.12, 0.85), 'army'),
    H(38, "A million people took to the streets again against martial law. Three young men from Hunan splattered paint on Mao's portrait on Tiananmen Gate — students hauled them off to the police station.", (g) => g.addSeeds(0.03), 'crowd'),
    H(40, "The troops pulled out a few days earlier were replaced by fresh units brought in from other regions.", null, 'opp'),
    { at: 42, title: "May 27 · Withdraw or Stay", art: '⛺', text: "Student leaders met and proposed leaving the Square on May 30 and returning to campus.<br>But many students who had come from outside Beijing disagreed: if we leave, they said, we'll have nothing.", choices: [
      { label: "Withdraw and regroup", hint: "Most go home · Regime alert −25 (did not happen historically)", run: (g) => { const s = g.sim; for (let i = 0; i < s.o.N; i++) if (s.a[i] && s.rng() < 0.7) s.a[i] = 0; g.addAlert(-25); g.flags.withdrew = true; } },
      { label: "Hold the Square", hint: "Regime alert +5 (the historical choice)", run: (g) => { g.addAlert(5); g.griefAll(0.005); } },
    ] },
    H(43, "Chinese around the world took to the streets on the same day in support of Beijing.", (g) => { g.base.globalScale = Math.min(1, g.base.globalScale + 0.05); }),
    H(47, "Foreign journalists' access to the Square was restricted. Satellite broadcasts were cut.", (g) => g.forcePolicy('info', 'blackout', 99, "Feeds cut"), 'opp'),
    H(48, "Liu Xiaobo, Hou Dejian, Zhou Duo and Gao Xin began a hunger strike on the Square. Late at night, near Muxidi, a police jeep ran down and killed three passersby.", (g) => g.griefAll(0.02)),
  ];

  /* ---------------- 莱比锡 1989 (每轮一天) ---------------- */
  TL.leipzig = [
    H(2, "Plainclothes Stasi men took photographs around St. Nicholas Church, recording every face.", null, 'opp'),
    H(4, "Another group of people “vanished” across the Hungarian border."),
    H(6, "New Forum was founded and issued its appeal, “Awakening 89.” Within days, thousands had signed.", (g) => g.addEdgesFrac && g.addEdgesFrac(0.15)),
    H(7, "Monday: after the peace prayers, dozens of people were taken away at the church doors."),
    H(10, "A meeting at work: “Who signed the appeal?”"),
    H(14, "Monday: more people outside the church than last week. For the first time, someone shouted: “We're staying here!”", (g) => g.addSeeds(0.008)),
    H(17, "The Interior Ministry refused to register New Forum, calling it “hostile to the state.”", (g) => g.griefAll(0.01)),
    H(19, "On West German TV, every day: East Germans crammed into the West German embassy in Prague."),
    H(21, "Monday: for the first time, the demonstrators left the church and marched onto the Ring. Several thousand people.", (g) => g.addSeeds(0.015), 'crowd'),
    H(24, "The Party paper printed a reader's letter: “These people don't speak for us.”"),
    H(28, "Monday: about 20,000 people. Some chanted, “Gorby! Gorby!”", (g) => g.addSeeds(0.02), 'crowd'),
    H(30, "Trains carrying the Prague refugees passed through Dresden. Thousands tried to storm the station and climb aboard; the police waded in.", (g) => g.griefAll(0.015)),
    H(34, "Dresden: demonstrators chose a “Group of 20,” and the mayor agreed to talk with them.", (g) => g.addAlert(-5)),
    H(37, "For the first time, the Party paper changed its tone: it was willing to “discuss.”"),
    H(40, "In a factory, someone wrote “We are the people” on a machine tool."),
    H(42, "October 16, a Monday. Outside St. Nicholas Church and on the Ring, the crowds were bigger than last week.", (g) => g.addSeeds(0.01)),
    H(43, "East Berlin: in the Socialist Unity Party's Politburo, some began discussing how to remove Honecker."),
  ];

  /* ---------------- 2022 (每轮一天) ---------------- */
  TL.baizhi = [
    H(1, "“Sitong Bridge,” “Haidian” and “warrior” were censored. On a public toilet partition, someone wrote out the words from the banners.", (g) => g.griefAll(0.006)),
    H(5, "Posters in solidarity with Sitong Bridge went up on noticeboards at many universities abroad.", (g) => { g.base.globalScale = Math.min(1, g.base.globalScale + 0.03); }),
    H(9, "At the closing session of the 20th Party Congress, the former president was led out of the hall by the arm. The camera quickly cut away."),
    H(10, "The new Politburo Standing Committee made its debut."),
    H(14, "Another city announced “static management.”"),
    H(17, "Foxconn Zhengzhou: locked-down workers climbed the fences and walked dozens of kilometers home along the highways.", (g) => g.griefAll(0.012)),
    H(18, "Shanghai Disneyland suddenly shut its gates; visitors were trapped inside awaiting PCR results."),
    H(19, "Lanzhou: a three-year-old boy had carbon monoxide poisoning. The lockdown kept him from reaching a hospital in time. He could not be saved.", (g) => g.griefAll(0.02)),
    H(25, "“Dynamic zero-COVID” entered its third winter."),
    H(32, "Haizhu District, Guangzhou: locked-down residents pushed over the barriers.", (g) => g.addSeeds(0.004)),
    H(38, "The Qatar World Cup opened. On TV, the stands were packed with people without masks.", (g) => g.griefAll(0.015)),
    H(41, "Foxconn Zhengzhou: new hires clashed with COVID-control staff over pay. The videos were reposted many times before they were deleted.", (g) => g.griefAll(0.01)),
    H(46, "In Shanghai, the Urumqi Middle Road street signs were taken down. Police lined the street.", null, 'opp'),
    H(48, "Official announcement: Jiang Zemin has died."),
    H(50, "Guangzhou, Shijiazhuang and other cities began quietly easing COVID restrictions."),
    H(53, "Word is that new COVID rules are about to be announced."),
  ];

  /* ---------------- 朝鲜 (每轮一个月) ---------------- */
  TL.pyongyang = [
    H(1, "The Hanoi summit ended with nothing. State TV showed only Kim Jong-un setting off by train."),
    H(2, "The inminban head went door to door checking radios: were the lead seals on the tuning knobs still intact?", null, 'opp'),
    H(3, "State Security's new trick: cut the power first, then go in — the disc is stuck in the player and can't be ejected.", null, 'opp'),
    H(5, "Panmunjom: Trump stepped across the Military Demarcation Line."),
    H(7, "In the jangmadang (markets), Chinese-made portable players are in hot demand."),
    H(9, "By the river, someone took a mobile call from the far bank."),
    H(14, "With the border closed, rice prices in the markets went up.", (g) => g.griefAll(0.008)),
    H(17, "North Korea blew up the inter-Korean liaison office in Kaesong."),
    H(19, "Typhoons and floods destroyed the fields.", (g) => g.griefAll(0.01)),
    H(21, "A parade for the Party's 75th anniversary. Kim Jong-un choked up in his speech and apologized to the people.", (g) => g.griefScale(0.95)),
    H(24, "Eighth Congress of the Workers' Party: the five-year plan “was not fulfilled.”"),
    H(26, "People say a neighbor's child was sent to a labor camp — over a South Korean song.", (g) => g.griefAll(0.008)),
    H(32, "Market hours were restricted.", (g) => { g.bonusIncome -= 0.1; }),
    H(35, "Reportedly: for the tenth anniversary of Kim Jong-il's death, drinking, shopping and laughing were banned nationwide for eleven days."),
    H(38, "Among the young, the way people talk in South Korean dramas caught on. The regime began arresting people for the accent.", (g) => g.griefAll(0.006)),
    H(44, "The Supreme People's Assembly passed a law on nuclear forces policy."),
    H(46, "Winter is coming again."),
  ];

  /* ---------------- 清明 1976 (每轮半天, 3月19日起) ---------------- */
  TL.qingming = [
    H(2, "On the shop floor, someone slipped the Premier's photo inside a work pass."),
    H(4, "The loudspeakers were reading an article on “Counterattacking the Right-Deviationist Wind to Reverse Verdicts.” The reader's voice was flat; the listeners didn't look up."),
    H(6, "A few scattered people laid flowers at the Monument to the People's Heroes. Not far off, someone was watching and taking note of their faces.", (g) => g.addAlert(2), 'opp'),
    H(8, "At a work-unit study session, someone asked quietly: why was the Premier's memorial service so rushed? No one answered."),
    H(10, "Someone tied a small white flower to the Monument's marble railing.", (g) => g.addSeeds(0.004)),
    H(12, "A front-page article in the Wenhui Bao contained this line: “That capitalist-roader inside the Party wanted to put back into power the capitalist-roader who was toppled and still refuses to repent.” Every reader knew who it meant.", (g) => { g.griefAll(0.02); g.sim.reveal(0.1); }),
    H(14, "In Beijing's factories, people secretly passed that paper around."),
    H(16, "Reportedly, telegrams and letters demanding an explanation reached the Wenhui Bao."),
    H(20, "Trains in from Nanjing still bore traces of the words “Down with Zhang Chunqiao.” Workers at Beijing Station saw them.", (g) => g.addSeeds(0.005)),
    H(22, "More wreaths at the Monument. Some work units brought them in formation; some people came alone, carrying one on their shoulder.", (g) => g.addSeeds(0.006)),
    H(24, "Someone read a eulogy aloud at the Monument. The crowd listening kept growing."),
    H(26, "Reportedly, the Party Center has ruled the Nanjing events a “counterrevolutionary incident.”", (g) => g.addAlert(8), 'opp'),
    H(27, "At night, people were still keeping watch over the wreaths at the Monument."),
    H(29, "Workers coming off the night shift didn't go home. They went straight to the Square.", (g) => g.addSeeds(0.006)),
    H(31, "On the Square, people held up flashlights and copied out the poems, character by character.", (g) => g.griefAll(0.008)),
  ];

  /* ---------------- 首尔 1987 (1—5月每轮一周, 6月每轮一天) ---------------- */
  TL.seoul = [
    H(1, "January 19: police admitted to “water torture” of Park Jong-chul. Two officers were arrested.", (g) => g.griefAll(0.01)),
    H(2, "Black banners went up on university campuses across the country."),
    H(3, "February 7: police blocked memorials for Park Jong-chul across the country. Many were taken away.", (g) => g.addSeeds(0.006), 'arrest'),
    H(5, "At factory and church gatherings, people spoke in low voices about “torture.”"),
    H(7, "March 3, the forty-ninth day after Park Jong-chul's death. The “National Peace March to Banish Torture” was broken up too.", (g) => g.addSeeds(0.008)),
    H(9, "The opposition squabbled endlessly over constitutional reform."),
    H(11, "The cherry blossoms are out. The campuses are quiet."),
    H(14, "One after another, university professors issued statements against the “protect the constitution” decision.", (g) => g.griefAll(0.008)),
    H(15, "Priests, pastors, writers and filmmakers issued statements too.", (g) => g.griefAll(0.006)),
    H(16, "The seventh anniversary of the Gwangju Uprising was approaching."),
    H(19, "May 27: opposition parties, religious groups and student organizations jointly founded the “National Movement Headquarters for a Democratic Constitution.”", (g) => { g.bonusIncome += 0.1; }),
    H(20, "June. The ruling party set June 10 to nominate Roh Tae-woo as its presidential candidate."),
    H(23, "On campus, students were preparing for the “June 10 National Rally.”"),
    H(27, "The National Movement Headquarters announced: at 6 p.m. on June 10, drivers will sound their horns together and churches will ring their bells."),
    H(30, "Myeongdong Cathedral: demonstrators staged a sit-in inside; priests stood guard at the doors."),
    H(33, "Busan, Gwangju, Daejeon… people in the streets everywhere.", (g) => g.addSeeds(0.01)),
    H(34, "The Myeongdong sit-in ended; the demonstrators left the cathedral safely."),
    H(35, "Front pages of the evening papers: row upon row of tear-gas canisters, face upon face in tears."),
    H(37, "June 18, the “Rally to Banish Tear Gas”: dozens of cities took to the streets at once.", (g) => g.addSeeds(0.03)),
    H(40, "Debate inside the ruling party: concede, or crack down?"),
    H(43, "June 24: Chun Doo-hwan met opposition leader Kim Young-sam. No result."),
    H(47, "The crowds in the streets did not go home."),
  ];

  /* ---------------- 布加勒斯特 1989 (每轮半天, 12月15日起) ---------------- */
  TL.bucharest = [
    H(1, "Timișoara: dozens of parishioners linked arms outside the pastor's house."),
    H(2, "The crowd at the pastor's door kept growing; Romanians joined the ethnic Hungarian parishioners.", (g) => g.addSeeds(0.006), 'crowd'),
    H(4, (g) => (g.flags.shot ? "Tanks rolled into the streets of Timișoara. The hospitals were full of wounded." : "On the streets of Timișoara, people were still talking about the day before.")),
    H(5, "Securitate report: the situation is under control.", null, 'intel'),
    H(7, (g) => (g.flags.shot ? "Reportedly, the bodies of the dead were taken to Bucharest overnight and secretly cremated." : "People were listening to Radio Free Europe's Romanian broadcasts."), (g) => { if (g.flags.shot) { const s = g.sim; for (let i = 0; i < g.N; i++) s.latent[i] += 0.03; } }),
    H(8, "Radio Free Europe and Voice of America were broadcasting the news from Timișoara.", (g) => g.sim.reveal(0.3)),
    H(9, "In the bread lines, people lowered their voices and spoke the name of a city."),
    H(13, (g) => (g.x > 0.02 ? "Barricades went up in University Square. People shouted, “We won't leave!”" : "Bucharest was quiet at night. The streetlights were dark.")),
    H(16, (g) => (g.x > 0.05 ? "Crowds packed the area outside the state television building." : "The factories worked as usual.")),
    H(18, "Christmas was approaching."),
    H(20, "December 25, Christmas Day."),
    H(24, "The reports say: all is normal.", null, 'intel'),
    H(28, "People queued for meat for the New Year."),
    H(33, "New Year's Eve."),
  ];

  const api = { TL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SilenceTimelines = api;
})(typeof window !== 'undefined' ? window : globalThis);

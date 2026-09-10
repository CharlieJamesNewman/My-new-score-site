(() => {
  const logos = {
    arsenal: 'https://thumb.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/120px-Arsenal_FC.svg.png',
    liverpool: 'https://thumb.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/120px-Liverpool_FC.svg.png',
    'manchester city': 'https://thumb.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/120px-Manchester_City_FC_badge.svg.png',
    chelsea: 'https://thumb.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/120px-Chelsea_FC.svg.png',
    newcastle: 'https://thumb.wikimedia.org/wikipedia/en/thumb/5/56/Newcastle_United_Logo.svg/120px-Newcastle_United_Logo.svg.png',
    tottenham: 'https://thumb.wikimedia.org/wikipedia/en/thumb/b/b4/Tottenham_Hotspur.svg/120px-Tottenham_Hotspur.svg.png',
    'manchester united': 'https://thumb.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/120px-Manchester_United_FC_crest.svg.png',
    'aston villa': 'https://thumb.wikimedia.org/wikipedia/en/thumb/9/9a/Aston_Villa_FC_new_crest.svg/120px-Aston_Villa_FC_new_crest.svg.png',
    brighton: 'https://thumb.wikimedia.org/wikipedia/en/thumb/d/d0/Brighton_and_Hove_Albion_FC_crest.svg/120px-Brighton_and_Hove_Albion_FC_crest.svg.png',
    'west ham': 'https://thumb.wikimedia.org/wikipedia/en/thumb/c/c2/West_Ham_United_FC_logo.svg/120px-West_Ham_United_FC_logo.svg.png',
    'crystal palace': 'https://thumb.wikimedia.org/wikipedia/en/thumb/a/a2/Crystal_Palace_FC_logo_%282022%29.svg/120px-Crystal_Palace_FC_logo_%282022%29.svg.png',
    everton: 'https://thumb.wikimedia.org/wikipedia/en/thumb/7/7c/Everton_FC_logo.svg/120px-Everton_FC_logo.svg.png',
    brentford: 'https://thumb.wikimedia.org/wikipedia/en/thumb/2/2a/Brentford_FC_crest.svg/120px-Brentford_FC_crest.svg.png',
    fulham: 'https://thumb.wikimedia.org/wikipedia/en/thumb/e/eb/Fulham_FC_%28shield%29.svg/120px-Fulham_FC_%28shield%29.svg.png',
    bournemouth: 'https://thumb.wikimedia.org/wikipedia/en/thumb/e/e5/AFC_Bournemouth_%282013%29.svg/120px-AFC_Bournemouth_%282013%29.svg.png',
    wolves: 'https://thumb.wikimedia.org/wikipedia/en/thumb/c/c9/Wolverhampton_Wanderers_FC_crest.svg/120px-Wolverhampton_Wanderers_FC_crest.svg.png',
    'nottingham forest': 'https://thumb.wikimedia.org/wikipedia/en/thumb/e/e5/Nottingham_Forest_F.C._logo.svg/120px-Nottingham_Forest_F.C._logo.svg.png',
    'leeds united': 'https://thumb.wikimedia.org/wikipedia/en/thumb/5/54/Leeds_United_F.C._logo.svg/120px-Leeds_United_F.C._logo.svg.png',
    burnley: 'https://thumb.wikimedia.org/wikipedia/en/thumb/6/6d/Burnley_FC_Logo.svg/120px-Burnley_FC_Logo.svg.png',
    sunderland: 'https://thumb.wikimedia.org/wikipedia/en/thumb/7/77/Logo_Sunderland.svg/120px-Logo_Sunderland.svg.png',
    'real madrid': 'https://thumb.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/120px-Real_Madrid_CF.svg.png',
    barcelona: 'https://thumb.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/120px-FC_Barcelona_%28crest%29.svg.png',
    'atletico madrid': 'https://thumb.wikimedia.org/wikipedia/en/thumb/f/f9/Atletico_Madrid_Logo_2024.svg/120px-Atletico_Madrid_Logo_2024.svg.png',
    villarreal: 'https://thumb.wikimedia.org/wikipedia/en/thumb/b/b9/Villarreal_CF_logo-en.svg/120px-Villarreal_CF_logo-en.svg.png',
    'real betis': 'https://thumb.wikimedia.org/wikipedia/en/thumb/2/2f/Real_Betis_2022_logo.svg/120px-Real_Betis_2022_logo.svg.png',
    'athletic club': 'https://thumb.wikimedia.org/wikipedia/en/thumb/9/98/Club_Athletic_Bilbao_logo.svg/120px-Club_Athletic_Bilbao_logo.svg.png',
    'real sociedad': 'https://thumb.wikimedia.org/wikipedia/en/thumb/f/f1/Real_Sociedad_logo.svg/120px-Real_Sociedad_logo.svg.png',
    sevilla: 'https://thumb.wikimedia.org/wikipedia/en/thumb/3/3b/Sevilla_FC_logo.svg/120px-Sevilla_FC_logo.svg.png',
    valencia: 'https://thumb.wikimedia.org/wikipedia/en/thumb/c/ce/Valenciacf.svg/120px-Valenciacf.svg.png',
    girona: 'https://thumb.wikimedia.org/wikipedia/en/thumb/f/f7/Girona_FC_Logo.svg/120px-Girona_FC_Logo.svg.png',
    'celta vigo': 'https://thumb.wikimedia.org/wikipedia/en/thumb/1/12/RC_Celta_de_Vigo_logo.svg/120px-RC_Celta_de_Vigo_logo.svg.png',
    'rayo vallecano': 'https://thumb.wikimedia.org/wikipedia/en/thumb/d/d8/Rayo_Vallecano_logo.svg/120px-Rayo_Vallecano_logo.svg.png',
    mallorca: 'https://thumb.wikimedia.org/wikipedia/en/thumb/e/e0/Rcd_mallorca.svg/120px-Rcd_mallorca.svg.png',
    getafe: 'https://thumb.wikimedia.org/wikipedia/en/thumb/4/46/Getafe_logo.svg/120px-Getafe_logo.svg.png',
    osasuna: 'https://thumb.wikimedia.org/wikipedia/en/thumb/3/38/CA_Osasuna_2024_crest.svg/120px-CA_Osasuna_2024_crest.svg.png',
    alaves: 'https://thumb.wikimedia.org/wikipedia/en/thumb/f/f8/Deportivo_Alaves_logo_%282020%29.svg/120px-Deportivo_Alaves_logo_%282020%29.svg.png',
    espanyol: 'https://thumb.wikimedia.org/wikipedia/en/thumb/9/92/RCD_Espanyol_crest.svg/120px-RCD_Espanyol_crest.svg.png',
    levante: 'https://thumb.wikimedia.org/wikipedia/en/thumb/7/7b/Levante_Uni%C3%B3n_Deportiva%2C_S.A.D._logo.svg/120px-Levante_Uni%C3%B3n_Deportiva%2C_S.A.D._logo.svg.png',
    elche: 'https://thumb.wikimedia.org/wikipedia/en/thumb/a/a7/Elche_CF_logo.svg/120px-Elche_CF_logo.svg.png',
    'real oviedo': 'https://thumb.wikimedia.org/wikipedia/en/thumb/6/6e/Real_Oviedo_logo.svg/120px-Real_Oviedo_logo.svg.png',
    napoli: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/SSC_Napoli_2025_%28white_and_azure%29.svg/120px-SSC_Napoli_2025_%28white_and_azure%29.svg.png',
    inter: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/FC_Internazionale_Milano_2021.svg/120px-FC_Internazionale_Milano_2021.svg.png',
    juventus: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Juventus_FC_-_logo_black_%28Italy%2C_2020%29.svg/120px-Juventus_FC_-_logo_black_%28Italy%2C_2020%29.svg.png',
    'ac milan': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/120px-Logo_of_AC_Milan.svg.png',
    roma: 'https://thumb.wikimedia.org/wikipedia/en/thumb/f/f7/AS_Roma_logo_%282017%29.svg/120px-AS_Roma_logo_%282017%29.svg.png',
    atalanta: 'https://thumb.wikimedia.org/wikipedia/en/thumb/f/f2/Atalanta_BC_new_logo.svg/120px-Atalanta_BC_new_logo.svg.png',
    lazio: 'https://thumb.wikimedia.org/wikipedia/en/thumb/c/ce/S.S._Lazio_badge.svg/120px-S.S._Lazio_badge.svg.png',
    fiorentina: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/ACF_Fiorentina_-_logo_%28Italy%2C_2022%29.svg/120px-ACF_Fiorentina_-_logo_%28Italy%2C_2022%29.svg.png',
    bologna: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Bologna_F.C._1909_logo.svg/120px-Bologna_F.C._1909_logo.svg.png',
    torino: 'https://thumb.wikimedia.org/wikipedia/en/thumb/2/2e/Torino_FC_Logo.svg/120px-Torino_FC_Logo.svg.png',
    genoa: 'https://thumb.wikimedia.org/wikipedia/en/thumb/2/2c/Genoa_CFC_crest.svg/120px-Genoa_CFC_crest.svg.png',
    udinese: 'https://thumb.wikimedia.org/wikipedia/en/thumb/c/ce/Udinese_Calcio_logo.svg/120px-Udinese_Calcio_logo.svg.png',
    sassuolo: 'https://thumb.wikimedia.org/wikipedia/en/thumb/1/1c/US_Sassuolo_Calcio_logo.svg/120px-US_Sassuolo_Calcio_logo.svg.png',
    parma: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Logo_Parma_Calcio_1913_%28adozione_2016%29.svg/120px-Logo_Parma_Calcio_1913_%28adozione_2016%29.svg.png',
    cagliari: 'https://thumb.wikimedia.org/wikipedia/en/thumb/6/61/Cagliari_Calcio_1920.svg/120px-Cagliari_Calcio_1920.svg.png',
    verona: 'https://thumb.wikimedia.org/wikipedia/en/thumb/9/92/Hellas_Verona_FC_logo_%282020%29.svg/120px-Hellas_Verona_FC_logo_%282020%29.svg.png',
    lecce: 'https://thumb.wikimedia.org/wikipedia/en/thumb/2/23/US_Lecce_crest.svg/120px-US_Lecce_crest.svg.png',
    empoli: 'https://thumb.wikimedia.org/wikipedia/en/thumb/f/fb/Empoli_FC_crest.svg/120px-Empoli_FC_crest.svg.png',
    monza: 'https://thumb.wikimedia.org/wikipedia/en/thumb/a/a7/AC_Monza_logo_%282021%29.svg/120px-AC_Monza_logo_%282021%29.svg.png',
    venezia: 'https://thumb.wikimedia.org/wikipedia/en/thumb/3/39/Venezia_FC_crest.svg/120px-Venezia_FC_crest.svg.png',
    'bayern munich': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8d/FC_Bayern_M%C3%BCnchen_logo_%282024%29.svg/120px-FC_Bayern_M%C3%BCnchen_logo_%282024%29.svg.png',
    'borussia dortmund': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Borussia_Dortmund_logo.svg/120px-Borussia_Dortmund_logo.svg.png',
    'rb leipzig': 'https://thumb.wikimedia.org/wikipedia/en/thumb/0/04/RB_Leipzig_2014_logo.svg/120px-RB_Leipzig_2014_logo.svg.png',
    'bayer leverkusen': 'https://thumb.wikimedia.org/wikipedia/en/thumb/5/59/Bayer_04_Leverkusen_logo.svg/120px-Bayer_04_Leverkusen_logo.svg.png',
    'eintracht frankfurt': 'https://thumb.wikimedia.org/wikipedia/en/thumb/7/7e/Eintracht_Frankfurt_crest.svg/120px-Eintracht_Frankfurt_crest.svg.png',
    stuttgart: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/VfB_Stuttgart_1893_Logo.svg/120px-VfB_Stuttgart_1893_Logo.svg.png',
    freiburg: 'https://thumb.wikimedia.org/wikipedia/en/thumb/6/6d/SC_Freiburg_logo.svg/120px-SC_Freiburg_logo.svg.png',
    mainz: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/1._FSV_Mainz_05_logo.svg/120px-1._FSV_Mainz_05_logo.svg.png',
    wolfsburg: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/VfL_Wolfsburg_logo_2026.svg/120px-VfL_Wolfsburg_logo_2026.svg.png',
    'werder bremen': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/be/SV-Werder-Bremen-Logo.svg/120px-SV-Werder-Bremen-Logo.svg.png',
    'borussia monchengladbach': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Borussia_M%C3%B6nchengladbach_logo.svg/120px-Borussia_M%C3%B6nchengladbach_logo.svg.png',
    'union berlin': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/1._FC_Union_Berlin_Logo.svg/120px-1._FC_Union_Berlin_Logo.svg.png',
    augsburg: 'https://thumb.wikimedia.org/wikipedia/en/thumb/c/c5/FC_Augsburg_logo.svg/120px-FC_Augsburg_logo.svg.png',
    hoffenheim: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Logo_TSG_Hoffenheim.svg/120px-Logo_TSG_Hoffenheim.svg.png',
    heidenheim: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/1._FC_Heidenheim_1846.svg/120px-1._FC_Heidenheim_1846.svg.png',
    'st pauli': 'https://thumb.wikimedia.org/wikipedia/en/thumb/8/8f/FC_St._Pauli_logo_%282018%29.svg/120px-FC_St._Pauli_logo_%282018%29.svg.png',
    'holstein kiel': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Holstein_Kiel_Logo.svg/120px-Holstein_Kiel_Logo.svg.png',
    bochum: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/VfL_Bochum_logo.svg/120px-VfL_Bochum_logo.svg.png',
    'paris saint germain': 'https://thumb.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/120px-Paris_Saint-Germain_F.C..svg.png',
    marseille: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Olympique_de_Marseille_2026_logo.svg/120px-Olympique_de_Marseille_2026_logo.svg.png',
    monaco: 'https://thumb.wikimedia.org/wikipedia/en/thumb/c/cf/LogoASMonacoFC2021.svg/120px-LogoASMonacoFC2021.svg.png',
    lille: 'https://thumb.wikimedia.org/wikipedia/en/thumb/3/3f/Lille_OSC_2018_logo.svg/120px-Lille_OSC_2018_logo.svg.png',
    lyon: 'https://thumb.wikimedia.org/wikipedia/en/thumb/1/1c/Olympique_Lyonnais_logo.svg/120px-Olympique_Lyonnais_logo.svg.png',
    nice: 'https://thumb.wikimedia.org/wikipedia/en/thumb/2/2e/OGC_Nice_logo.svg/120px-OGC_Nice_logo.svg.png',
    lens: 'https://thumb.wikimedia.org/wikipedia/en/thumb/c/cc/RC_Lens_logo.svg/120px-RC_Lens_logo.svg.png',
    rennes: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9e/Stade_Rennais_FC.svg/120px-Stade_Rennais_FC.svg.png',
    strasbourg: 'https://thumb.wikimedia.org/wikipedia/en/thumb/8/80/Racing_Club_de_Strasbourg_logo.svg/120px-Racing_Club_de_Strasbourg_logo.svg.png',
    brest: 'https://thumb.wikimedia.org/wikipedia/en/thumb/0/05/Stade_Brestois_29_logo.svg/120px-Stade_Brestois_29_logo.svg.png',
    auxerre: 'https://thumb.wikimedia.org/wikipedia/en/thumb/5/51/AJAuxerreLogo.svg/120px-AJAuxerreLogo.svg.png',
    nantes: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/45/Logo_FC_Nantes_%28avec_fond%29_-_2019.svg/120px-Logo_FC_Nantes_%28avec_fond%29_-_2019.svg.png',
    toulouse: 'https://thumb.wikimedia.org/wikipedia/en/thumb/6/63/Toulouse_FC_2018_logo.svg/120px-Toulouse_FC_2018_logo.svg.png',
    reims: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Stade_de_Reims_logo.svg/120px-Stade_de_Reims_logo.svg.png',
    'le havre': 'https://thumb.wikimedia.org/wikipedia/en/thumb/f/fc/Le_Havre_AC_logo.svg/120px-Le_Havre_AC_logo.svg.png',
    montpellier: 'https://thumb.wikimedia.org/wikipedia/en/thumb/a/a8/Montpellier_HSC_logo.svg/120px-Montpellier_HSC_logo.svg.png',
    'saint etienne': 'https://thumb.wikimedia.org/wikipedia/en/thumb/2/25/AS_Saint-%C3%89tienne_logo.svg/120px-AS_Saint-%C3%89tienne_logo.svg.png',
    angers: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Angers_Sporting_Club_de_l%27Ouest_logo.svg/120px-Angers_Sporting_Club_de_l%27Ouest_logo.svg.png'
  };

  const aliases = {
    forest: 'nottingham forest',
    dortmund: 'borussia dortmund',
    leverkusen: 'bayer leverkusen',
    psg: 'paris saint germain',
    atletico: 'atletico madrid',
    'newcastle united': 'newcastle',
    'tottenham hotspur': 'tottenham',
    'west ham united': 'west ham',
    'brighton hove albion': 'brighton',
    'wolverhampton wanderers': 'wolves',
    'afc bournemouth': 'bournemouth',
    'athletic bilbao': 'athletic club',
    'deportivo alaves': 'alaves',
    'inter milan': 'inter',
    'as roma': 'roma',
    'hellas verona': 'verona',
    bayern: 'bayern munich',
    'fc barcelona': 'barcelona',
    'paris saint-germain': 'paris saint germain',
    'man city': 'manchester city',
    'man united': 'manchester united',
    'man utd': 'manchester united'
  };

  const style = document.createElement('style');
  style.textContent = '.crest img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))}';
  document.head.appendChild(style);

  function normalize(name) {
    return (name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function teamName(crest) {
    if (crest.dataset.team) return crest.dataset.team;
    const parent = crest.parentElement;
    return (parent.textContent || '').replace(crest.textContent || '', '').trim();
  }

  function badgeUrl(team) {
    const key = normalize(team);
    const canonical = aliases[key] || key;
    return logos[canonical] || logos[canonical.replace(/^(afc|fc|ac|as|ssc|ss|us|rc|ogc|aj)\s+/, '')] || null;
  }

  function decorate() {
    for (const crest of document.querySelectorAll('.crest:not([data-badge-ready])')) {
      const team = teamName(crest);
      if (!team) continue;
      crest.dataset.badgeReady = 'true';
      const url = badgeUrl(team);
      if (!url) continue;
      const image = new Image();
      image.alt = `${team} crest`;
      image.referrerPolicy = 'no-referrer';
      image.src = url;
      crest.replaceChildren(image);
    }
  }

  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
  decorate();
})();

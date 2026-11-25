'use strict';
// Questions d'interview sans IA (2.0, round C), par thème. Le thème suit l'émission (podcast = vie perso et carrière,
// plateau télé = football, magazine = style de vie, chaîne du club = le club, documentaire = carrière, live caritatif =
// la cause). {C} club, {O} émission. Il répond par un ton (ouvert, prudent, audacieux, collectif) : pas de texte libre.
// Ajouter une question = une entrée { fr, en, pt, es, it, de } dans le bon thème ; pickFresh évite les répétitions.

const INTERVIEW_QUESTIONS = {
  personal: [
    { fr: 'Qui est la personne qui t’a le plus aidé à arriver là où tu es ?', en: 'Who helped you the most to get where you are?', pt: 'Quem mais te ajudou a chegar onde você está?', es: '¿Quién te ayudó más a llegar hasta aquí?', it: 'Chi ti ha aiutato di più ad arrivare fin qui?', de: 'Wer hat dir am meisten geholfen, so weit zu kommen?' },
    { fr: 'À quoi ressemble une journée off pour toi, loin du football ?', en: 'What does a day off look like for you, away from football?', pt: 'Como é um dia de folga para você, longe do futebol?', es: '¿Cómo es un día libre para ti, lejos del fútbol?', it: 'Com’è una giornata libera per te, lontano dal calcio?', de: 'Wie sieht ein freier Tag für dich aus, weit weg vom Fußball?' },
    { fr: 'Qu’est-ce que les gens ne savent pas sur toi ?', en: 'What don’t people know about you?', pt: 'O que as pessoas não sabem sobre você?', es: '¿Qué es lo que la gente no sabe de ti?', it: 'Che cosa la gente non sa di te?', de: 'Was wissen die Leute nicht über dich?' },
    { fr: 'Comment ta famille vit-elle ta carrière ?', en: 'How does your family live through your career?', pt: 'Como sua família vive a sua carreira?', es: '¿Cómo vive tu familia tu carrera?', it: 'Come vive la tua famiglia la tua carriera?', de: 'Wie erlebt deine Familie deine Karriere?' },
    { fr: 'Quelle musique écoutes-tu avant un match ?', en: 'What music do you listen to before a game?', pt: 'Que música você ouve antes de um jogo?', es: '¿Qué música escuchas antes de un partido?', it: 'Che musica ascolti prima di una partita?', de: 'Welche Musik hörst du vor einem Spiel?' },
    { fr: 'Ton premier souvenir avec un ballon ?', en: 'Your first memory with a football?', pt: 'Sua primeira lembrança com uma bola?', es: '¿Tu primer recuerdo con un balón?', it: 'Il tuo primo ricordo con un pallone?', de: 'Deine erste Erinnerung an einen Fußball?' },
    { fr: 'Est-ce que la pression te fait parfois douter ?', en: 'Does the pressure ever make you doubt yourself?', pt: 'A pressão às vezes te faz duvidar?', es: '¿La presión te hace dudar a veces?', it: 'La pressione a volte ti fa dubitare?', de: 'Lässt dich der Druck manchmal zweifeln?' },
  ],
  football: [
    { fr: 'Comment analyses-tu la saison de {C} jusqu’ici ?', en: 'How do you rate {C}’s season so far?', pt: 'Como você avalia a temporada do {C} até agora?', es: '¿Cómo valoras la temporada del {C} hasta ahora?', it: 'Come giudichi la stagione del {C} finora?', de: 'Wie bewertest du die Saison von {C} bisher?' },
    { fr: 'Quel adversaire t’a posé le plus de problèmes cette saison ?', en: 'Which opponent has given you the most trouble this season?', pt: 'Qual adversário te deu mais trabalho nesta temporada?', es: '¿Qué rival te ha dado más problemas esta temporada?', it: 'Quale avversario ti ha creato più problemi in questa stagione?', de: 'Welcher Gegner hat dir in dieser Saison die meisten Probleme bereitet?' },
    { fr: 'Le système du coach te convient-il ?', en: 'Does the coach’s system suit you?', pt: 'O esquema do treinador combina com você?', es: '¿Te va bien el sistema del entrenador?', it: 'Il modulo dell’allenatore ti si addice?', de: 'Passt dir das System des Trainers?' },
    { fr: 'Quel est l’objectif réaliste pour {C} cette saison ?', en: 'What’s a realistic target for {C} this season?', pt: 'Qual é o objetivo realista do {C} nesta temporada?', es: '¿Cuál es el objetivo realista del {C} esta temporada?', it: 'Qual è l’obiettivo realistico del {C} in questa stagione?', de: 'Was ist ein realistisches Ziel für {C} in dieser Saison?' },
    { fr: 'Sur quoi travailles-tu le plus à l’entraînement en ce moment ?', en: 'What are you working on most in training right now?', pt: 'No que você mais está trabalhando nos treinos agora?', es: '¿En qué estás trabajando más en los entrenamientos ahora?', it: 'Su cosa stai lavorando di più in allenamento adesso?', de: 'Woran arbeitest du im Training gerade am meisten?' },
    { fr: 'Le match que tu revois le plus souvent dans ta tête ?', en: 'The game you replay most often in your head?', pt: 'O jogo que você mais revê na cabeça?', es: '¿El partido que más repasas en tu cabeza?', it: 'La partita che rivedi più spesso nella tua testa?', de: 'Das Spiel, das du am häufigsten im Kopf durchgehst?' },
    { fr: 'Quel joueur de l’équipe est le plus sous-estimé ?', en: 'Who’s the most underrated player in the squad?', pt: 'Qual jogador do elenco é o mais subestimado?', es: '¿Qué jugador de la plantilla está más infravalorado?', it: 'Qual è il giocatore più sottovalutato della rosa?', de: 'Wer ist der unterschätzteste Spieler im Kader?' },
  ],
  lifestyle: [
    { fr: 'Ton style, c’est plutôt discret ou tu aimes te faire remarquer ?', en: 'Is your style low-key, or do you like to stand out?', pt: 'Seu estilo é discreto ou você gosta de chamar atenção?', es: '¿Tu estilo es discreto o te gusta llamar la atención?', it: 'Il tuo stile è sobrio o ti piace farti notare?', de: 'Ist dein Stil eher dezent, oder fällst du gern auf?' },
    { fr: 'Le plus bel achat que tu t’es offert depuis que tu es pro ?', en: 'The best thing you’ve bought yourself since turning pro?', pt: 'A melhor compra que você fez desde que virou profissional?', es: '¿Lo mejor que te has comprado desde que eres profesional?', it: 'L’acquisto più bello che ti sei fatto da professionista?', de: 'Das Schönste, was du dir als Profi gekauft hast?' },
    { fr: 'Comment gères-tu les réseaux sociaux et les critiques ?', en: 'How do you handle social media and the criticism?', pt: 'Como você lida com as redes sociais e as críticas?', es: '¿Cómo llevas las redes sociales y las críticas?', it: 'Come gestisci i social e le critiche?', de: 'Wie gehst du mit Social Media und Kritik um?' },
    { fr: 'Une ville où tu rêves de vivre après ta carrière ?', en: 'A city you dream of living in after your career?', pt: 'Uma cidade onde você sonha morar depois da carreira?', es: '¿Una ciudad donde sueñas vivir después de tu carrera?', it: 'Una città dove sogni di vivere dopo la carriera?', de: 'Eine Stadt, in der du nach deiner Karriere leben möchtest?' },
    { fr: 'Ton plat préféré, et celui que tu t’interdis ?', en: 'Your favourite dish, and the one you won’t let yourself have?', pt: 'Seu prato favorito, e aquele que você se proíbe?', es: '¿Tu plato favorito, y el que te prohíbes?', it: 'Il tuo piatto preferito, e quello che ti vieti?', de: 'Dein Lieblingsessen, und das, das du dir verbietest?' },
    { fr: 'L’argent a-t-il changé ta façon de vivre ?', en: 'Has money changed the way you live?', pt: 'O dinheiro mudou seu jeito de viver?', es: '¿El dinero ha cambiado tu forma de vivir?', it: 'I soldi hanno cambiato il tuo modo di vivere?', de: 'Hat Geld deine Art zu leben verändert?' },
  ],
  club: [
    { fr: 'Que représente {C} pour toi ?', en: 'What does {C} mean to you?', pt: 'O que o {C} representa para você?', es: '¿Qué significa el {C} para ti?', it: 'Che cosa rappresenta il {C} per te?', de: 'Was bedeutet dir {C}?' },
    { fr: 'Un message pour les supporters qui vous suivent partout ?', en: 'A message for the fans who follow you everywhere?', pt: 'Uma mensagem para a torcida que acompanha vocês em todo lugar?', es: '¿Un mensaje para la afición que os sigue a todas partes?', it: 'Un messaggio per i tifosi che vi seguono ovunque?', de: 'Eine Botschaft an die Fans, die euch überallhin folgen?' },
    { fr: 'Qui est le plus drôle du vestiaire ?', en: 'Who’s the funniest in the dressing room?', pt: 'Quem é o mais engraçado do vestiário?', es: '¿Quién es el más gracioso del vestuario?', it: 'Chi è il più simpatico dello spogliatoio?', de: 'Wer ist der Lustigste in der Kabine?' },
    { fr: 'Ton moment préféré sous ce maillot ?', en: 'Your favourite moment in this shirt?', pt: 'Seu momento favorito com esta camisa?', es: '¿Tu momento favorito con esta camiseta?', it: 'Il tuo momento preferito con questa maglia?', de: 'Dein schönster Moment in diesem Trikot?' },
    { fr: 'Comment se passe la vie au centre d’entraînement ?', en: 'What’s life like at the training ground?', pt: 'Como é a vida no centro de treinamento?', es: '¿Cómo es la vida en la ciudad deportiva?', it: 'Com’è la vita al centro sportivo?', de: 'Wie ist das Leben am Trainingsgelände?' },
    { fr: 'Les jeunes de l’académie te demandent souvent des conseils ?', en: 'Do the academy kids often ask you for advice?', pt: 'Os garotos da base costumam te pedir conselhos?', es: '¿Los chicos de la cantera te piden consejos a menudo?', it: 'I ragazzi del vivaio ti chiedono spesso consigli?', de: 'Fragen dich die Jugendspieler oft um Rat?' },
  ],
  career: [
    { fr: 'Le moment où tu as su que tu deviendrais professionnel ?', en: 'The moment you knew you’d become a professional?', pt: 'O momento em que você soube que seria profissional?', es: '¿El momento en que supiste que serías profesional?', it: 'Il momento in cui hai capito che saresti diventato professionista?', de: 'Der Moment, in dem du wusstest, dass du Profi wirst?' },
    { fr: 'Le choix de carrière le plus difficile que tu aies fait ?', en: 'The hardest career decision you’ve made?', pt: 'A decisão mais difícil da sua carreira?', es: '¿La decisión más difícil de tu carrera?', it: 'La scelta più difficile della tua carriera?', de: 'Die schwerste Entscheidung deiner Karriere?' },
    { fr: 'Où te vois-tu dans cinq ans ?', en: 'Where do you see yourself in five years?', pt: 'Onde você se vê daqui a cinco anos?', es: '¿Dónde te ves dentro de cinco años?', it: 'Dove ti vedi tra cinque anni?', de: 'Wo siehst du dich in fünf Jahren?' },
    { fr: 'Un échec qui t’a fait grandir ?', en: 'A setback that made you grow?', pt: 'Um fracasso que te fez crescer?', es: '¿Un fracaso que te hizo crecer?', it: 'Un fallimento che ti ha fatto crescere?', de: 'Ein Rückschlag, an dem du gewachsen bist?' },
    { fr: 'Le coach qui t’a le plus marqué ?', en: 'The coach who left the biggest mark on you?', pt: 'O treinador que mais te marcou?', es: '¿El entrenador que más te marcó?', it: 'L’allenatore che ti ha segnato di più?', de: 'Der Trainer, der dich am meisten geprägt hat?' },
    { fr: 'Quel héritage aimerais-tu laisser ?', en: 'What legacy would you like to leave?', pt: 'Que legado você gostaria de deixar?', es: '¿Qué legado te gustaría dejar?', it: 'Che eredità vorresti lasciare?', de: 'Welches Vermächtnis möchtest du hinterlassen?' },
  ],
  cause: [
    { fr: 'Pourquoi cette cause compte-t-elle pour toi ?', en: 'Why does this cause matter to you?', pt: 'Por que essa causa é importante para você?', es: '¿Por qué te importa esta causa?', it: 'Perché questa causa è importante per te?', de: 'Warum ist dir dieses Anliegen wichtig?' },
    { fr: 'Les footballeurs en font-ils assez pour leur communauté ?', en: 'Do footballers do enough for their community?', pt: 'Os jogadores fazem o bastante pela comunidade?', es: '¿Hacen los futbolistas lo suficiente por su comunidad?', it: 'I calciatori fanno abbastanza per la loro comunità?', de: 'Tun Fußballer genug für ihre Gemeinschaft?' },
    { fr: 'Un enfant que tu as rencontré et qui t’a marqué ?', en: 'A child you met who stayed with you?', pt: 'Uma criança que você conheceu e que te marcou?', es: '¿Un niño que conociste y que te marcó?', it: 'Un bambino che hai conosciuto e che ti è rimasto dentro?', de: 'Ein Kind, das du getroffen hast und nicht vergisst?' },
    { fr: 'Que dirais-tu à ceux qui hésitent à donner ?', en: 'What would you say to people unsure about giving?', pt: 'O que você diria a quem hesita em doar?', es: '¿Qué dirías a quien duda en donar?', it: 'Cosa diresti a chi esita a donare?', de: 'Was sagst du Leuten, die beim Spenden zögern?' },
    { fr: 'Ton premier geste solidaire, tu t’en souviens ?', en: 'Do you remember the first time you gave back?', pt: 'Você se lembra do seu primeiro gesto solidário?', es: '¿Recuerdas tu primer gesto solidario?', it: 'Ti ricordi il tuo primo gesto di solidarietà?', de: 'Erinnerst du dich an deine erste gute Tat?' },
  ],
  general: [
    { fr: 'Merci d’être avec nous sur {O}. Comment te sens-tu en ce moment ?', en: 'Thanks for joining us on {O}. How are you feeling right now?', pt: 'Obrigado por estar no {O}. Como você está se sentindo agora?', es: 'Gracias por estar en {O}. ¿Cómo te sientes ahora mismo?', it: 'Grazie di essere con noi a {O}. Come ti senti in questo momento?', de: 'Danke, dass du bei {O} bist. Wie fühlst du dich gerade?' },
    { fr: 'Un conseil à ton toi de quinze ans ?', en: 'One piece of advice for your fifteen-year-old self?', pt: 'Um conselho para você aos quinze anos?', es: '¿Un consejo para ti con quince años?', it: 'Un consiglio al te stesso di quindici anni?', de: 'Ein Rat an dein fünfzehnjähriges Ich?' },
    { fr: 'Le joueur que tu admirais enfant ?', en: 'The player you looked up to as a kid?', pt: 'O jogador que você admirava quando criança?', es: '¿El jugador al que admirabas de niño?', it: 'Il giocatore che ammiravi da bambino?', de: 'Zu welchem Spieler hast du als Kind aufgeschaut?' },
    { fr: 'Qu’est-ce qui te fait le plus rire en ce moment ?', en: 'What makes you laugh the most these days?', pt: 'O que mais te faz rir ultimamente?', es: '¿Qué es lo que más te hace reír últimamente?', it: 'Cosa ti fa ridere di più in questo periodo?', de: 'Was bringt dich zurzeit am meisten zum Lachen?' },
    { fr: 'Une habitude que tu ne lâcherais pour rien au monde ?', en: 'A habit you’d never give up?', pt: 'Um hábito que você não largaria por nada?', es: '¿Un hábito que no dejarías por nada?', it: 'Un’abitudine a cui non rinunceresti per niente al mondo?', de: 'Eine Gewohnheit, die du nie aufgeben würdest?' },
    { fr: 'Si tu n’étais pas footballeur, tu serais… ?', en: 'If you weren’t a footballer, you’d be…?', pt: 'Se você não fosse jogador, seria…?', es: 'Si no fueras futbolista, serías…?', it: 'Se non fossi un calciatore, saresti…?', de: 'Wenn du kein Fußballer wärst, wärst du…?' },
    { fr: 'Le compliment qui t’a le plus touché ?', en: 'The compliment that meant the most to you?', pt: 'O elogio que mais te tocou?', es: '¿El elogio que más te llegó?', it: 'Il complimento che ti ha toccato di più?', de: 'Das Kompliment, das dir am meisten bedeutet hat?' },
    { fr: 'Pour finir : un mot pour ceux qui nous regardent ?', en: 'To finish: a word for everyone watching?', pt: 'Para terminar: uma palavra para quem está nos vendo?', es: 'Para terminar: ¿unas palabras para quienes nos ven?', it: 'Per chiudere: una parola per chi ci guarda?', de: 'Zum Schluss: ein Wort an alle, die zuschauen?' },
  ],
};

// Les thèmes de chaque genre d'émission (le premier compte double).
const INTERVIEW_THEMES = {
  podcast: ['personal', 'career', 'general'],
  tv_show: ['football', 'general'],
  magazine_cover: ['lifestyle', 'personal'],
  club_channel: ['club', 'football'],
  documentary: ['career', 'personal'],
  charity_stream: ['cause', 'personal'],
};

module.exports = { INTERVIEW_QUESTIONS, INTERVIEW_THEMES };

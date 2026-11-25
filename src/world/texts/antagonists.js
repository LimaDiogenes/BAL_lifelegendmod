'use strict';
// Les antagonistes (2.0) : rival, détracteur, critique, ex-coach sceptique, ex, ancien coéquipier jaloux. Ils piquent,
// ne vont jamais jusqu'à l'insulte (mêmes limites que la colère des supporters). {H} = @pseudo du joueur, {I} = l'achat.
// Situations : good (bon match), bad (mauvais match), flex (achat de luxe), provoke (la provocation qui ouvre une décision).
// Ajouter une variante = une entrée { fr, en, pt, es, it, de } de plus.

const ANTAGONIST_POSTS = {
  rival_player: {
    good: [
      { fr: 'Joli match de {H}. Profite, la saison est longue 😏', en: 'Nice game from {H}. Enjoy it, the season is long 😏', pt: 'Bom jogo do {H}. Aproveita, a temporada é longa 😏', es: 'Buen partido de {H}. Disfrútalo, la temporada es larga 😏', it: 'Bella partita di {H}. Goditela, la stagione è lunga 😏', de: 'Gutes Spiel von {H}. Genieß es, die Saison ist lang 😏' },
      { fr: 'Un bon match, ça ne fait pas une carrière. On en reparle en mai {H}.', en: 'One good game doesn’t make a career. Talk to me in May {H}.', pt: 'Um bom jogo não faz uma carreira. A gente conversa em maio {H}.', es: 'Un buen partido no hace una carrera. Hablamos en mayo {H}.', it: 'Una bella partita non fa una carriera. Ne riparliamo a maggio {H}.', de: 'Ein gutes Spiel macht noch keine Karriere. Wir sprechen uns im Mai {H}.' },
    ],
    bad: [
      { fr: 'Dur soir pour {H}. Ça arrive… surtout à lui 😅', en: 'Tough night for {H}. It happens… especially to him 😅', pt: 'Noite difícil pro {H}. Acontece… principalmente com ele 😅', es: 'Noche dura para {H}. Pasa… sobre todo a él 😅', it: 'Serata difficile per {H}. Capita… soprattutto a lui 😅', de: 'Harter Abend für {H}. Passiert… vor allem ihm 😅' },
      { fr: 'Je ne dis rien. Les chiffres parlent pour moi 📉 {H}', en: 'I’m saying nothing. The numbers speak for me 📉 {H}', pt: 'Não vou falar nada. Os números falam por mim 📉 {H}', es: 'No digo nada. Los números hablan por mí 📉 {H}', it: 'Non dico niente. I numeri parlano per me 📉 {H}', de: 'Ich sage nichts. Die Zahlen sprechen für mich 📉 {H}' },
      { fr: 'Bon courage pour la suite {H}. Vraiment.', en: 'Good luck with the rest {H}. Really.', pt: 'Boa sorte com o resto {H}. De verdade.', es: 'Mucha suerte con lo que viene {H}. De verdad.', it: 'In bocca al lupo per il resto {H}. Davvero.', de: 'Viel Glück für den Rest {H}. Wirklich.' },
    ],
    flex: [
      { fr: '{I} ? Moi, je préfère les trophées 🏆 {H}', en: '{I}? I prefer trophies myself 🏆 {H}', pt: '{I}? Eu prefiro troféus 🏆 {H}', es: '¿{I}? Yo prefiero los trofeos 🏆 {H}', it: '{I}? Io preferisco i trofei 🏆 {H}', de: '{I}? Ich bevorzuge Pokale 🏆 {H}' },
      { fr: 'Beau {I}. Dommage que ça ne marque pas de buts {H}.', en: 'Nice {I}. Shame it doesn’t score goals {H}.', pt: 'Belo {I}. Pena que não faz gol {H}.', es: 'Bonito {I}. Lástima que no marque goles {H}.', it: 'Bel {I}. Peccato che non segni gol {H}.', de: 'Schönes {I}. Schade, dass es keine Tore schießt {H}.' },
    ],
    provoke: [
      { fr: 'Tout le monde parle de {H}. Moi, j’attends de le voir face à un vrai défenseur.', en: 'Everyone’s talking about {H}. I’m waiting to see him against a real defender.', pt: 'Todo mundo fala do {H}. Eu quero ver ele contra um zagueiro de verdade.', es: 'Todo el mundo habla de {H}. Yo espero verlo contra un defensa de verdad.', it: 'Tutti parlano di {H}. Io aspetto di vederlo contro un vero difensore.', de: 'Alle reden über {H}. Ich will ihn mal gegen einen echten Verteidiger sehen.' },
      { fr: 'Surcoté. Je l’ai dit, je le redis. {H}', en: 'Overrated. I said it, I’ll say it again. {H}', pt: 'Superestimado. Já falei e repito. {H}', es: 'Sobrevalorado. Lo dije y lo repito. {H}', it: 'Sopravvalutato. L’ho detto e lo ripeto. {H}', de: 'Überbewertet. Ich hab’s gesagt und sag’s wieder. {H}' },
    ],
  },
  hater: {
    good: [
      { fr: 'Même une horloge cassée donne l’heure deux fois par jour. {H}', en: 'Even a broken clock is right twice a day. {H}', pt: 'Até relógio parado acerta a hora duas vezes por dia. {H}', es: 'Hasta un reloj parado acierta dos veces al día. {H}', it: 'Anche un orologio rotto segna l’ora giusta due volte al giorno. {H}', de: 'Auch eine kaputte Uhr geht zweimal am Tag richtig. {H}' },
      { fr: 'Contre cette défense, ma grand-mère aurait marqué aussi 🙄 {H}', en: 'Against that defence my grandma would have scored too 🙄 {H}', pt: 'Contra essa defesa até minha avó marcava 🙄 {H}', es: 'Contra esa defensa hasta mi abuela marcaba 🙄 {H}', it: 'Contro quella difesa avrebbe segnato anche mia nonna 🙄 {H}', de: 'Gegen diese Abwehr hätte sogar meine Oma getroffen 🙄 {H}' },
    ],
    bad: [
      { fr: 'Je vous l’avais dit. Personne ne m’écoute jamais. {H}', en: 'I told you. Nobody ever listens to me. {H}', pt: 'Eu avisei. Ninguém nunca me escuta. {H}', es: 'Os lo dije. Nadie me escucha nunca. {H}', it: 'Ve l’avevo detto. Nessuno mi ascolta mai. {H}', de: 'Ich hab’s euch gesagt. Keiner hört je auf mich. {H}' },
      { fr: 'Le vrai {H} est de retour : invisible 👻', en: 'The real {H} is back: invisible 👻', pt: 'O verdadeiro {H} voltou: invisível 👻', es: 'Ha vuelto el verdadero {H}: invisible 👻', it: 'È tornato il vero {H}: invisibile 👻', de: 'Der echte {H} ist zurück: unsichtbar 👻' },
      { fr: 'Combien de temps on va encore faire semblant ? {H}', en: 'How much longer are we going to pretend? {H}', pt: 'Até quando vamos fingir? {H}', es: '¿Hasta cuándo vamos a fingir? {H}', it: 'Fino a quando faremo finta di niente? {H}', de: 'Wie lange tun wir noch so? {H}' },
    ],
    flex: [
      { fr: '{I}, mais toujours pas de passe décisive 😂 {H}', en: '{I}, but still no assists 😂 {H}', pt: '{I}, mas nada de assistência 😂 {H}', es: '{I}, pero ni una asistencia 😂 {H}', it: '{I}, ma ancora nessun assist 😂 {H}', de: '{I}, aber immer noch keine Vorlage 😂 {H}' },
      { fr: 'Les priorités de {H} : {I} d’abord, le foot ensuite.', en: '{H}’s priorities: {I} first, football second.', pt: 'As prioridades do {H}: {I} primeiro, futebol depois.', es: 'Las prioridades de {H}: {I} primero, el fútbol después.', it: 'Le priorità di {H}: {I} prima, il calcio dopo.', de: '{H}s Prioritäten: erst {I}, dann Fußball.' },
    ],
    provoke: [
      { fr: 'Je lance le débat : {H} est le joueur le plus surcoté de la ligue. Changez mon avis.', en: 'Debate time: {H} is the most overrated player in the league. Change my mind.', pt: 'Abro o debate: {H} é o jogador mais superestimado da liga. Me convençam do contrário.', es: 'Abro el debate: {H} es el jugador más sobrevalorado de la liga. Convencedme de lo contrario.', it: 'Apro il dibattito: {H} è il giocatore più sopravvalutato del campionato. Fatemi cambiare idea.', de: 'Diskussion: {H} ist der überbewertetste Spieler der Liga. Überzeugt mich vom Gegenteil.' },
      { fr: 'Rappel : {H} n’a toujours rien gagné. Juste pour info.', en: 'Reminder: {H} still hasn’t won anything. Just saying.', pt: 'Lembrete: {H} ainda não ganhou nada. Só pra constar.', es: 'Recordatorio: {H} todavía no ha ganado nada. Solo digo.', it: 'Promemoria: {H} non ha ancora vinto niente. Tanto per dire.', de: 'Zur Erinnerung: {H} hat immer noch nichts gewonnen. Nur so.' },
    ],
  },
  tough_critic: {
    good: [
      { fr: 'Bonne performance de {H}, reconnaissons-le. Reste à le faire contre les grands.', en: 'A good performance from {H}, credit where it’s due. Now do it against the big sides.', pt: 'Boa atuação do {H}, é preciso reconhecer. Agora falta contra os grandes.', es: 'Buena actuación de {H}, hay que reconocerlo. Falta hacerlo contra los grandes.', it: 'Buona prestazione di {H}, va riconosciuto. Ora deve farlo contro le grandi.', de: 'Starke Leistung von {H}, das muss man anerkennen. Jetzt noch gegen die Großen.' },
      { fr: 'Efficace, oui. Constant ? On verra. {H}', en: 'Effective, yes. Consistent? We’ll see. {H}', pt: 'Eficiente, sim. Regular? Veremos. {H}', es: 'Eficaz, sí. ¿Regular? Ya veremos. {H}', it: 'Efficace, sì. Costante? Vedremo. {H}', de: 'Effektiv, ja. Konstant? Mal sehen. {H}' },
    ],
    bad: [
      { fr: 'Match en dessous pour {H}. La question de son niveau se pose à nouveau.', en: 'A poor game from {H}. Questions about his level are back.', pt: 'Jogo abaixo do {H}. A dúvida sobre o nível dele volta.', es: 'Partido flojo de {H}. Vuelven las dudas sobre su nivel.', it: 'Partita sottotono di {H}. Tornano i dubbi sul suo livello.', de: 'Schwaches Spiel von {H}. Die Frage nach seinem Niveau stellt sich wieder.' },
      { fr: 'Sans {H} à son niveau, l’équipe n’avance pas. Ce soir, c’était flagrant.', en: 'Without {H} at his level, the team doesn’t move. Tonight it was obvious.', pt: 'Sem o {H} no nível dele, o time não anda. Hoje ficou claro.', es: 'Sin {H} a su nivel, el equipo no avanza. Hoy fue evidente.', it: 'Senza {H} al suo livello, la squadra non va. Stasera era evidente.', de: 'Ohne {H} in Form kommt das Team nicht voran. Heute war es offensichtlich.' },
      { fr: 'Trop de déchet technique. {H} doit se remettre en question.', en: 'Too many loose touches. {H} needs to take a hard look at himself.', pt: 'Muitos erros técnicos. {H} precisa se cobrar.', es: 'Demasiadas pérdidas. {H} tiene que hacer autocrítica.', it: 'Troppi errori tecnici. {H} deve farsi un esame di coscienza.', de: 'Zu viele technische Fehler. {H} muss sich hinterfragen.' },
    ],
    flex: [
      { fr: 'Chacun dépense son argent comme il veut. Mais l’image compte aussi, {H}.', en: 'Everyone spends their money as they like. But image matters too, {H}.', pt: 'Cada um gasta o dinheiro como quer. Mas a imagem também conta, {H}.', es: 'Cada uno gasta su dinero como quiere. Pero la imagen también cuenta, {H}.', it: 'Ognuno spende i soldi come vuole. Ma anche l’immagine conta, {H}.', de: 'Jeder gibt sein Geld aus, wie er will. Aber das Image zählt auch, {H}.' },
      { fr: '{I} en pleine saison ? Le timing interroge. {H}', en: '{I} in the middle of the season? The timing raises questions. {H}', pt: '{I} no meio da temporada? O timing levanta dúvidas. {H}', es: '¿{I} en plena temporada? El momento genera dudas. {H}', it: '{I} a metà stagione? Il tempismo fa discutere. {H}', de: '{I} mitten in der Saison? Das Timing wirft Fragen auf. {H}' },
    ],
    provoke: [
      { fr: 'Mon édito de la semaine : {H} est-il vraiment indispensable ? Je n’en suis pas sûr.', en: 'My column this week: is {H} really indispensable? I’m not so sure.', pt: 'Minha coluna da semana: {H} é mesmo indispensável? Não tenho certeza.', es: 'Mi columna de la semana: ¿es {H} realmente imprescindible? No estoy seguro.', it: 'Il mio editoriale della settimana: {H} è davvero indispensabile? Non ne sono sicuro.', de: 'Meine Kolumne diese Woche: Ist {H} wirklich unverzichtbar? Ich bin nicht sicher.' },
      { fr: 'J’attends toujours que {H} réponde à mes questions. Silence radio.', en: 'Still waiting for {H} to answer my questions. Radio silence.', pt: 'Ainda espero que o {H} responda às minhas perguntas. Silêncio total.', es: 'Sigo esperando que {H} responda a mis preguntas. Silencio absoluto.', it: 'Aspetto ancora che {H} risponda alle mie domande. Silenzio totale.', de: 'Ich warte immer noch auf {H}s Antworten. Funkstille.' },
    ],
  },
  doubter: {
    good: [
      { fr: 'Je n’y croyais pas à l’époque. Bon… on peut se tromper. Parfois. {H}', en: 'I didn’t believe in him back then. Well… people can be wrong. Sometimes. {H}', pt: 'Eu não acreditava nele naquela época. Bom… dá pra errar. Às vezes. {H}', es: 'No creía en él entonces. Bueno… uno se puede equivocar. A veces. {H}', it: 'Allora non ci credevo. Beh… si può sbagliare. A volte. {H}', de: 'Damals hab ich nicht an ihn geglaubt. Naja… man kann sich irren. Manchmal. {H}' },
      { fr: 'Il a progressé, je le reconnais. Les bases, c’est chez nous qu’il les a apprises. {H}', en: 'He’s improved, I’ll admit it. He learned the basics with us, though. {H}', pt: 'Ele evoluiu, reconheço. Mas o básico aprendeu com a gente. {H}', es: 'Ha mejorado, lo reconozco. Pero lo básico lo aprendió con nosotros. {H}', it: 'È migliorato, lo ammetto. Le basi però le ha imparate da noi. {H}', de: 'Er hat sich verbessert, zugegeben. Die Grundlagen hat er aber bei uns gelernt. {H}' },
    ],
    bad: [
      { fr: 'Les mêmes défauts qu’à seize ans. Certaines choses ne changent pas. {H}', en: 'The same flaws he had at sixteen. Some things never change. {H}', pt: 'Os mesmos defeitos dos dezesseis anos. Algumas coisas não mudam. {H}', es: 'Los mismos defectos que a los dieciséis. Hay cosas que no cambian. {H}', it: 'Gli stessi difetti di quando aveva sedici anni. Certe cose non cambiano. {H}', de: 'Dieselben Schwächen wie mit sechzehn. Manche Dinge ändern sich nie. {H}' },
      { fr: 'Je l’avais écrit dans mon rapport, à l’époque. {H}', en: 'I wrote it in my report back then. {H}', pt: 'Eu escrevi isso no meu relatório na época. {H}', es: 'Lo escribí en mi informe en su día. {H}', it: 'L’avevo scritto nel mio rapporto, allora. {H}', de: 'Das stand damals schon in meinem Bericht. {H}' },
      { fr: 'Le talent sans la rigueur, voilà ce que je voyais déjà. {H}', en: 'Talent without discipline. That’s what I saw back then too. {H}', pt: 'Talento sem disciplina, era o que eu já via. {H}', es: 'Talento sin disciplina, es lo que ya veía entonces. {H}', it: 'Talento senza disciplina, è quello che vedevo già. {H}', de: 'Talent ohne Disziplin, das sah ich schon damals. {H}' },
    ],
    flex: [
      { fr: 'De mon temps, on s’achetait des crampons, pas {I}. {H}', en: 'In my day we bought boots, not {I}. {H}', pt: 'No meu tempo a gente comprava chuteira, não {I}. {H}', es: 'En mis tiempos comprábamos botas, no {I}. {H}', it: 'Ai miei tempi si compravano scarpini, non {I}. {H}', de: 'Zu meiner Zeit kaufte man Fußballschuhe, nicht {I}. {H}' },
      { fr: '{I}… Je me demande ce qu’en pense son entraîneur. {H}', en: '{I}… I wonder what his coach thinks of that. {H}', pt: '{I}… Fico pensando no que o treinador acha disso. {H}', es: '{I}… Me pregunto qué opina su entrenador. {H}', it: '{I}… Mi chiedo cosa ne pensi il suo allenatore. {H}', de: '{I}… Ich frage mich, was sein Trainer davon hält. {H}' },
    ],
    provoke: [
      { fr: 'On me demande souvent si je regrette de ne pas l’avoir gardé. Non. {H}', en: 'People often ask if I regret letting him go. No. {H}', pt: 'Sempre me perguntam se me arrependo de não ter ficado com ele. Não. {H}', es: 'A menudo me preguntan si me arrepiento de no haberlo retenido. No. {H}', it: 'Mi chiedono spesso se mi pento di non averlo tenuto. No. {H}', de: 'Man fragt mich oft, ob ich bereue, ihn gehen gelassen zu haben. Nein. {H}' },
      { fr: 'Un bon joueur, oui. Un grand ? Il lui manque encore quelque chose. {H}', en: 'A good player, yes. A great one? Something is still missing. {H}', pt: 'Um bom jogador, sim. Um grande? Ainda falta algo. {H}', es: 'Un buen jugador, sí. ¿Uno grande? Todavía le falta algo. {H}', it: 'Un buon giocatore, sì. Un grande? Gli manca ancora qualcosa. {H}', de: 'Ein guter Spieler, ja. Ein großer? Da fehlt noch etwas. {H}' },
    ],
  },
  ex_partner: {
    good: [
      { fr: 'Content pour lui. Vraiment. Enfin, je crois 🙂', en: 'Happy for him. Really. I think 🙂', pt: 'Feliz por ele. De verdade. Acho 🙂', es: 'Me alegro por él. De verdad. Creo 🙂', it: 'Contento per lui. Davvero. Credo 🙂', de: 'Ich freue mich für ihn. Wirklich. Glaube ich 🙂' },
      { fr: 'Il a toujours su briller en public. En privé, c’est une autre histoire 🤐', en: 'He always knew how to shine in public. In private, that’s another story 🤐', pt: 'Ele sempre soube brilhar em público. No privado, é outra história 🤐', es: 'Siempre supo brillar en público. En privado, es otra historia 🤐', it: 'Ha sempre saputo brillare in pubblico. In privato è un’altra storia 🤐', de: 'In der Öffentlichkeit glänzt er immer. Privat ist das eine andere Geschichte 🤐' },
    ],
    bad: [
      { fr: 'Certains ne changeront jamais 💅', en: 'Some people never change 💅', pt: 'Tem gente que nunca muda 💅', es: 'Hay gente que nunca cambia 💅', it: 'Certe persone non cambiano mai 💅', de: 'Manche ändern sich nie 💅' },
      { fr: 'Pas de commentaire. Mais je n’en pense pas moins 🍿', en: 'No comment. But I’m thinking it 🍿', pt: 'Sem comentários. Mas eu penso 🍿', es: 'Sin comentarios. Pero lo pienso 🍿', it: 'Nessun commento. Ma lo penso 🍿', de: 'Kein Kommentar. Aber ich denke mir meinen Teil 🍿' },
      { fr: 'Le karma a toujours un bon timing ✨', en: 'Karma always has great timing ✨', pt: 'O karma sempre chega na hora certa ✨', es: 'El karma siempre llega a tiempo ✨', it: 'Il karma ha sempre un tempismo perfetto ✨', de: 'Karma hat immer gutes Timing ✨' },
    ],
    flex: [
      { fr: '{I} ? Il disait qu’il détestait ça 😂', en: '{I}? He used to say he hated that 😂', pt: '{I}? Ele dizia que odiava isso 😂', es: '¿{I}? Decía que lo odiaba 😂', it: '{I}? Diceva di odiarlo 😂', de: '{I}? Er hat immer gesagt, er hasst so was 😂' },
      { fr: 'Il a enfin pris {I}. Il en parlait déjà quand on était ensemble 🙄', en: 'He finally got {I}. He was already talking about it when we were together 🙄', pt: 'Ele finalmente comprou {I}. Já falava disso quando a gente estava junto 🙄', es: 'Por fin se compró {I}. Ya hablaba de eso cuando estábamos juntos 🙄', it: 'Finalmente si è preso {I}. Ne parlava già quando stavamo insieme 🙄', de: 'Endlich hat er {I}. Davon hat er schon geredet, als wir zusammen waren 🙄' },
    ],
    provoke: [
      { fr: 'On me demande souvent comment il est en vrai. Disons que la caméra l’aime bien 📸', en: 'People keep asking what he’s really like. Let’s say the camera likes him 📸', pt: 'Sempre me perguntam como ele é de verdade. Digamos que a câmera gosta dele 📸', es: 'Siempre me preguntan cómo es de verdad. Digamos que la cámara lo quiere 📸', it: 'Mi chiedono sempre com’è davvero. Diciamo che la telecamera lo ama 📸', de: 'Alle fragen, wie er wirklich ist. Sagen wir, die Kamera mag ihn 📸' },
      { fr: 'Je pourrais écrire un livre. Je ne le ferai pas. Peut-être. 📖', en: 'I could write a book. I won’t. Maybe. 📖', pt: 'Eu poderia escrever um livro. Não vou. Talvez. 📖', es: 'Podría escribir un libro. No lo haré. Quizás. 📖', it: 'Potrei scrivere un libro. Non lo farò. Forse. 📖', de: 'Ich könnte ein Buch schreiben. Mach ich nicht. Vielleicht. 📖' },
    ],
  },
  jealous_mate: {
    good: [
      { fr: 'On jouait ensemble, et franchement j’étais meilleur à l’époque 😅 Bien joué quand même {H}', en: 'We played together and honestly I was better back then 😅 Well played anyway {H}', pt: 'A gente jogava junto e sinceramente eu era melhor na época 😅 Bem jogado mesmo assim {H}', es: 'Jugábamos juntos y la verdad es que yo era mejor entonces 😅 Bien jugado igualmente {H}', it: 'Giocavamo insieme e sinceramente ero più forte io allora 😅 Ben giocato comunque {H}', de: 'Wir haben zusammen gespielt und ehrlich, ich war damals besser 😅 Trotzdem gut gespielt {H}' },
      { fr: 'Il a eu les bonnes occasions au bon moment. La chance, ça compte. {H}', en: 'He got the right chances at the right time. Luck counts. {H}', pt: 'Ele teve as chances certas na hora certa. Sorte conta. {H}', es: 'Tuvo las oportunidades justas en el momento justo. La suerte cuenta. {H}', it: 'Ha avuto le occasioni giuste al momento giusto. La fortuna conta. {H}', de: 'Er hatte die richtigen Chancen zur richtigen Zeit. Glück zählt. {H}' },
    ],
    bad: [
      { fr: 'À l’entraînement il faisait déjà ça. Personne ne voulait le voir. {H}', en: 'He did that in training too. Nobody wanted to see it. {H}', pt: 'No treino ele já fazia isso. Ninguém queria ver. {H}', es: 'En los entrenamientos ya hacía eso. Nadie quería verlo. {H}', it: 'Lo faceva già in allenamento. Nessuno voleva vederlo. {H}', de: 'Im Training hat er das auch schon gemacht. Keiner wollte es sehen. {H}' },
      { fr: 'Et dire que c’est lui qu’on a gardé, pas moi… {H}', en: 'And to think they kept him, not me… {H}', pt: 'E pensar que ficaram com ele, não comigo… {H}', es: 'Y pensar que se quedaron con él y no conmigo… {H}', it: 'E pensare che hanno tenuto lui, non me… {H}', de: 'Und die haben ihn behalten, nicht mich… {H}' },
      { fr: 'Le vestiaire sait. Moi aussi. {H}', en: 'The dressing room knows. So do I. {H}', pt: 'O vestiário sabe. Eu também. {H}', es: 'El vestuario lo sabe. Yo también. {H}', it: 'Lo spogliatoio lo sa. Anch’io. {H}', de: 'Die Kabine weiß es. Ich auch. {H}' },
    ],
    flex: [
      { fr: '{I}… Il me doit toujours 20 balles, au passage {H} 😂', en: '{I}… He still owes me twenty quid, by the way {H} 😂', pt: '{I}… Ele ainda me deve vinte pila, aliás {H} 😂', es: '{I}… Por cierto, todavía me debe veinte pavos {H} 😂', it: '{I}… Tra l’altro mi deve ancora venti euro {H} 😂', de: '{I}… Er schuldet mir übrigens immer noch zwanzig Euro {H} 😂' },
      { fr: 'Facile de s’acheter {I} quand on a eu ma place. {H}', en: 'Easy to buy {I} when you got my spot. {H}', pt: 'Fácil comprar {I} quando pegou minha vaga. {H}', es: 'Fácil comprarse {I} cuando te quedaste con mi sitio. {H}', it: 'Facile comprarsi {I} quando hai preso il mio posto. {H}', de: 'Leicht, sich {I} zu kaufen, wenn man meinen Platz bekommen hat. {H}' },
    ],
    provoke: [
      { fr: 'Petite anecdote sur {H} au centre de formation… non, je garde ça pour mon podcast.', en: 'A little story about {H} at the academy… no, I’m saving it for my podcast.', pt: 'Uma historinha do {H} na base… não, vou guardar pro meu podcast.', es: 'Una anécdota de {H} en la cantera… no, me la guardo para mi podcast.', it: 'Un aneddoto su {H} al settore giovanile… no, lo tengo per il mio podcast.', de: 'Eine kleine Geschichte über {H} in der Jugend… nein, die heb ich mir für meinen Podcast auf.' },
      { fr: 'Tout le monde l’encense. Moi je me souviens du gamin qui pleurait après chaque défaite. {H}', en: 'Everyone praises him. I remember the kid who cried after every defeat. {H}', pt: 'Todo mundo exalta ele. Eu lembro do moleque que chorava a cada derrota. {H}', es: 'Todos lo alaban. Yo recuerdo al chaval que lloraba tras cada derrota. {H}', it: 'Tutti lo esaltano. Io ricordo il ragazzino che piangeva dopo ogni sconfitta. {H}', de: 'Alle loben ihn. Ich erinnere mich an den Jungen, der nach jeder Niederlage weinte. {H}' },
    ],
  },
};

// La scène après sa réponse à une provocation. h = titre, n = récit ; {N} = l'antagoniste, {H} = @pseudo du joueur.
const RIVAL_OUTCOME = {
  rival_reply: [
    { h: { fr: 'Il répond à {N}', en: 'He hits back at {N}', pt: 'Ele responde a {N}', es: 'Responde a {N}', it: 'Risponde a {N}', de: 'Er kontert {N}' }, n: { fr: 'Quelques mots, bien choisis, sous le post de {N}. Kop s’enflamme, les captures d’écran circulent déjà. Le staff, lui, aurait préféré le silence.', en: 'A few well-chosen words under {N}’s post. Kop is on fire and the screenshots are already everywhere. The staff would have preferred silence.', pt: 'Poucas palavras, bem escolhidas, no post de {N}. O Kop pegou fogo e os prints já circulam. A comissão técnica preferia o silêncio.', es: 'Pocas palabras, bien elegidas, bajo el post de {N}. Kop arde y las capturas ya circulan. El cuerpo técnico habría preferido el silencio.', it: 'Poche parole, ben scelte, sotto il post di {N}. Kop si infiamma e gli screenshot girano già. Lo staff avrebbe preferito il silenzio.', de: 'Ein paar gut gewählte Worte unter dem Post von {N}. Kop brennt, die Screenshots machen schon die Runde. Das Trainerteam hätte Schweigen lieber gesehen.' } },
    { h: { fr: 'Réponse cash à {N}', en: 'A straight answer to {N}', pt: 'Resposta direta a {N}', es: 'Respuesta directa a {N}', it: 'Risposta secca a {N}', de: 'Klare Antwort an {N}' }, n: { fr: '{H} ne laisse pas passer. Les supporters adorent, les journalistes notent. La suite se jouera sur le terrain.', en: '{H} doesn’t let it slide. The fans love it, the journalists take note. The rest will be settled on the pitch.', pt: '{H} não deixa passar. A torcida adora, os jornalistas anotam. O resto se resolve em campo.', es: '{H} no lo deja pasar. A la afición le encanta, los periodistas toman nota. Lo demás se decide en el campo.', it: '{H} non lascia correre. I tifosi adorano, i giornalisti prendono nota. Il resto si deciderà in campo.', de: '{H} lässt es nicht stehen. Die Fans lieben es, die Journalisten notieren es. Der Rest wird auf dem Platz entschieden.' } },
  ],
  rival_ignore: [
    { h: { fr: 'Pas un mot pour {N}', en: 'Not a word for {N}', pt: 'Nenhuma palavra para {N}', es: 'Ni una palabra para {N}', it: 'Nemmeno una parola per {N}', de: 'Kein Wort für {N}' }, n: { fr: 'Aucune réponse à {N}, juste une séance d’entraînement de plus. Au club, on apprécie le calme de {H}.', en: 'No reply to {N}, just one more training session. At the club, they appreciate {H}’s calm.', pt: 'Nenhuma resposta a {N}, só mais um treino. No clube, gostam da calma do {H}.', es: 'Ninguna respuesta a {N}, solo un entrenamiento más. En el club valoran la calma de {H}.', it: 'Nessuna risposta a {N}, solo un allenamento in più. Al club apprezzano la calma di {H}.', de: 'Keine Antwort an {N}, nur eine Trainingseinheit mehr. Im Verein schätzt man {H}s Ruhe.' } },
    { h: { fr: 'Le terrain répondra', en: 'The pitch will answer', pt: 'O campo vai responder', es: 'El campo responderá', it: 'Risponderà il campo', de: 'Der Platz wird antworten' }, n: { fr: '{N} attendait une réaction. Elle ne viendra pas sur Kop. {H} garde ses forces pour le prochain match.', en: '{N} was waiting for a reaction. It won’t come on Kop. {H} is saving his energy for the next game.', pt: '{N} esperava uma reação. Ela não virá no Kop. {H} guarda as forças para o próximo jogo.', es: '{N} esperaba una reacción. No llegará en Kop. {H} guarda fuerzas para el próximo partido.', it: '{N} aspettava una reazione. Non arriverà su Kop. {H} risparmia le energie per la prossima partita.', de: '{N} hat auf eine Reaktion gewartet. Sie kommt nicht auf Kop. {H} spart seine Kraft fürs nächste Spiel.' } },
  ],
  rival_joke: [
    { h: { fr: 'Il en rit', en: 'He laughs it off', pt: 'Ele leva na brincadeira', es: 'Se lo toma a risa', it: 'Ci ride sopra', de: 'Er lacht darüber' }, n: { fr: 'Un emoji, une blague, et la provocation de {N} tombe à plat. Les supporters partagent la réponse en masse 😂', en: 'An emoji, a joke, and {N}’s jab falls flat. The fans share the reply everywhere 😂', pt: 'Um emoji, uma piada, e a provocação de {N} perde a graça. A torcida compartilha a resposta em massa 😂', es: 'Un emoji, una broma, y la pulla de {N} se queda en nada. La afición comparte la respuesta en masa 😂', it: 'Un’emoji, una battuta, e la frecciata di {N} cade nel vuoto. I tifosi condividono la risposta ovunque 😂', de: 'Ein Emoji, ein Witz, und die Spitze von {N} verpufft. Die Fans teilen die Antwort massenhaft 😂' } },
    { h: { fr: 'Trop drôle pour s’énerver', en: 'Too funny to get angry', pt: 'Engraçado demais para se irritar', es: 'Demasiado gracioso para enfadarse', it: 'Troppo divertente per arrabbiarsi', de: 'Zu witzig, um sich aufzuregen' }, n: { fr: '{H} répond à {N} avec une seule photo et beaucoup d’humour. Même ses détracteurs sourient.', en: '{H} answers {N} with a single photo and plenty of humour. Even his critics smile.', pt: '{H} responde a {N} com uma única foto e muito humor. Até os críticos sorriem.', es: '{H} responde a {N} con una sola foto y mucho humor. Hasta sus detractores sonríen.', it: '{H} risponde a {N} con una sola foto e tanta ironia. Perfino i suoi detrattori sorridono.', de: '{H} antwortet {N} mit einem einzigen Foto und viel Humor. Sogar seine Kritiker lächeln.' } },
  ],
};

module.exports = { ANTAGONIST_POSTS, RIVAL_OUTCOME };

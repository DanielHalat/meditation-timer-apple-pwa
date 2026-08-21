# Meditation Timer — Apple PWA

Samodzielna, instalowalna wersja PWA przygotowana przede wszystkim do testów na iPhonie. Nie wymaga Xcode, Maca ani konta Apple Developer. Źródłem zachowania jest `Research/Meditation Timer - Ideas.md`, a źródłem układu mobilnego — aktualne ramki Green, Light, Dark i Active session w Figmie.

**Wersja online:** https://danielhalat.github.io/meditation-timer-apple-pwa/

## Co zawiera

- instalację na ekranie początkowym iPhone’a w trybie `standalone`;
- trzy motywy: Green, Light i Dark;
- timer countdown/count up, pauzę, wznowienie, potwierdzone zakończenie i wskaźnik postępu;
- cztery startowe presety oraz lokalne dodawanie, edycję, usuwanie i zmianę kolejności;
- pełnoekranowy mobilny edytor presetu zgodny z ramkami `Preset Flow` w Figmie: kierunek timera, dwa pola gongów, sekwencję interwałów ze stepperami i stałą akcję `Save`;
- sekwencje interwałów oraz osobne gongi Start & end i Interval;
- lokalny zapis w przeglądarce, działanie offline po pierwszym poprawnym uruchomieniu i blokadę układu do pionowej kompozycji;
- Screen Wake Lock, gdy przeglądarka i ustawienia telefonu na to pozwalają.

## Budowanie i testy

Projekt nie ma zewnętrznych zależności. Wymaga tylko Node.js.

```powershell
npm test
npm run build
npm start
```

`npm run build` tworzy gotową paczkę w `Builds/Apple PWA`. `npm start` udostępnia ją lokalnie pod `http://localhost:4173` do testu na tym samym komputerze.

## Instalacja na iPhonie

PWA musi być umieszczona pod publicznym adresem HTTPS. Można opublikować zawartość `Builds/Apple PWA` jako statyczną stronę, np. przez GitHub Pages, Cloudflare Pages albo Netlify. Następnie:

1. Otwórz publiczny adres **w Safari na iPhonie**.
2. W kompaktowym układzie Safari wybierz **… → Udostępnij**. W klasycznym układzie użyj przycisku udostępniania.
3. Wybierz **Dodaj do ekranu początkowego**; jeśli czynność jest ukryta, dodaj ją przez **Edytuj czynności** na dole listy.
4. Potwierdź nazwę i wybierz **Dodaj**.
5. Uruchamiaj timer z nowej ikony na ekranie początkowym, a nie z karty Safari.
6. Przy pierwszym uruchomieniu dźwięku zezwól na odtwarzanie i sprawdź głośność multimediów oraz tryb cichy.

## Aktualizacja zainstalowanej PWA

Po opublikowaniu nowej wersji iOS pobiera aktualizację automatycznie przy kolejnym uruchomieniu aplikacji z dostępem do internetu. Pierwsze otwarcie po publikacji może jeszcze pokazać poprzednią wersję, gdy w tle aktualizuje się cache. W takim przypadku zamknij PWA z przełącznika aplikacji i uruchom ją ponownie. Nie trzeba usuwać ikony ani dodawać aplikacji ponownie, a lokalne presety pozostają zachowane.

## Ważne ograniczenie iOS

To PWA jest użyteczną wersją testową, ale nie zastępuje w pełni natywnej aplikacji. iOS może uśpić kod i zablokować dźwięk po wygaszeniu ekranu albo przeniesieniu PWA do tła. Aplikacja oblicza czas z zegara systemowego po powrocie i próbuje utrzymać ekran aktywny, jednak gong graniczny lub końcowy nie ma gwarancji odtworzenia w tle. Niezawodne alarmy, audio i powiadomienia przy zablokowanym ekranie wymagają docelowo natywnej wersji iOS.

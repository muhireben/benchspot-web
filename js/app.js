import { BenchRepository } from "./bench-repository.js";
import { PhotoTools } from "./photo-tools.js";
import { PlaceNameService } from "./place-name-service.js";

(() => {
        const benchRepository = new BenchRepository();
        const placeNameService = new PlaceNameService();
        const belgiumBounds = L.latLngBounds([49.45, 2.45], [51.56, 6.42]);
        const map = L.map("map", { zoomControl: false, minZoom: 7 }).fitBounds(belgiumBounds);
        const mapWrap = document.querySelector(".map-wrap");
        let mapResizeFrame = null;
        const visualViewport = window.visualViewport;

        function scheduleMapResize() {
          if (mapResizeFrame !== null) return;
          mapResizeFrame = window.requestAnimationFrame(() => {
            mapResizeFrame = null;
            const viewportHeight = visualViewport ? visualViewport.height : window.innerHeight;
            const viewportTop = visualViewport ? visualViewport.offsetTop : 0;
            document.documentElement.style.setProperty("--visible-viewport-height", viewportHeight + "px");
            document.documentElement.style.setProperty("--visible-viewport-top", viewportTop + "px");
            map.invalidateSize({ pan: false });
          });
        }

        scheduleMapResize();
        window.addEventListener("resize", scheduleMapResize);
        window.addEventListener("orientationchange", scheduleMapResize);
        if (visualViewport) {
          visualViewport.addEventListener("resize", scheduleMapResize);
          visualViewport.addEventListener("scroll", scheduleMapResize);
        }
        if (window.ResizeObserver) {
          new ResizeObserver(scheduleMapResize).observe(mapWrap);
        }

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        L.control.zoom({ position: "bottomleft" }).addTo(map);

        const addButton = document.getElementById("add-button");
        const libraryButton = document.getElementById("library-button");
        const closeLibraryButton = document.getElementById("close-library-button");
        const refreshLibraryButton = document.getElementById("refresh-library-button");
        const citySelect = document.getElementById("city-select");
        const cityPicker = document.getElementById("city-picker");
        const cityPickerTrigger = document.getElementById("city-picker-trigger");
        const cityPickerLabel = document.getElementById("city-picker-label");
        const cityPickerMenu = document.getElementById("city-picker-menu");
        const cityPickerSearch = document.getElementById("city-picker-search");
        const cityPickerOptions = document.getElementById("city-picker-options");
        const locateButton = document.getElementById("locate-button");
        const mapLocateButton = document.getElementById("map-locate-button");
        const locationButtons = [locateButton, mapLocateButton];
        const addHereButton = document.getElementById("add-here-button");
        const locationStatus = document.getElementById("location-status");
        const locationPickerStatus = document.getElementById("location-picker-status");
        const nearbyOptions = document.getElementById("nearby-options");
        const nearbyRadius = document.getElementById("nearby-radius");
        const welcomeScreen = document.getElementById("welcome-screen");
        const cityPage = document.getElementById("city-page");
        const suggestionsSection = document.getElementById("suggestions-section");
        const changeCityButton = document.getElementById("change-city-button");
        const libraryHeading = document.getElementById("library-heading");
        const libraryCityName = document.getElementById("library-city-name");
        const mapCityLabel = document.getElementById("map-city-label");
        const hint = document.getElementById("map-hint");
        const dialog = document.getElementById("spot-dialog");
        const form = document.getElementById("spot-form");
        const nameInput = document.getElementById("spot-name");
        const nameHelp = document.getElementById("spot-name-help");
        const noteInput = document.getElementById("spot-note");
        const kindInput = document.getElementById("spot-kind");
        const coordinates = document.getElementById("coordinates");
        const list = document.getElementById("spot-list");
        const count = document.getElementById("spot-count");
        const storageStatus = document.getElementById("storage-status");
        const spotReviewNameInput = document.getElementById("spot-review-name");
        const spotReviewTextInput = document.getElementById("spot-review-text");
        const spotReviewPhotoInput = document.getElementById("spot-review-photos");
        const spotCameraPhotoInput = document.getElementById("spot-camera-photo");
        const spotPhotoPreviewList = document.getElementById("spot-photo-preview-list");
        const spotPhotoHelp = document.getElementById("spot-photo-help");
        const spotActionSummary = document.getElementById("spot-action-summary");
        const spotNoteDialog = document.getElementById("spot-note-dialog");
        const spotNoteForm = document.getElementById("spot-note-form");
        const spotPhotosDialog = document.getElementById("spot-photos-dialog");
        const spotReviewDialog = document.getElementById("spot-review-dialog");
        const spotReviewForm = document.getElementById("spot-review-form");
        const spotSubmitButton = form.querySelector('button[type="submit"]');
        const detailDialog = document.getElementById("detail-dialog");
        const reviewDialog = document.getElementById("review-dialog");
        const reviewForm = document.getElementById("review-form");
        const reviewNameInput = document.getElementById("review-name");
        const reviewTextInput = document.getElementById("review-text");
        const reviewPhotoInput = document.getElementById("review-photos-input");
        const photoPreviewList = document.getElementById("photo-preview-list");
        const photoHelp = document.getElementById("photo-help");
        const reviewSubmitButton = reviewForm.querySelector('button[type="submit"]');
        let pendingSpotPhotos = [];
        let spotPhotoPreviewUrls = [];
        const clearSpotPhotoPreviews = () => {
          spotPhotoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
          spotPhotoPreviewUrls = [];
          pendingSpotPhotos = [];
          spotPhotoPreviewList.replaceChildren();
          spotReviewPhotoInput.value = "";
          spotCameraPhotoInput.value = "";
          spotPhotoHelp.textContent = "Add up to 3 photos. Images are resized before saving.";
          updateSpotActionSummary();
        };
        const addSelectedSpotPhotos = (input) => {
          const selected = Array.from(input.files || []);
          input.value = "";
          const remaining = Math.max(0, 3 - pendingSpotPhotos.length);
          pendingSpotPhotos = pendingSpotPhotos.concat(selected.slice(0, remaining));
          if (selected.length > remaining) {
            spotPhotoHelp.textContent = "You can add up to 3 photos. Extra selections were not added.";
          } else {
            spotPhotoHelp.textContent = pendingSpotPhotos.length + " of 3 photos selected.";
          }
          spotPhotoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
          spotPhotoPreviewUrls = [];
          spotPhotoPreviewList.replaceChildren();
          pendingSpotPhotos.forEach((file) => {
            const url = URL.createObjectURL(file);
            spotPhotoPreviewUrls.push(url);
            const image = document.createElement("img");
            image.src = url;
            image.alt = "Selected photo preview";
            spotPhotoPreviewList.appendChild(image);
          });
          updateSpotActionSummary();
        };
        const clearReviewPhotoPreviews = PhotoTools.setupPicker(
          reviewPhotoInput,
          photoPreviewList,
          photoHelp,
          "Add up to 3 photos. Images are resized before saving."
        );
        let adding = false;
        let currentLocation = null;
        let locationMarker = null;
        let locationRequestId = 0;
        let pendingLocation = null;
        let pendingPlaceName = "";
        let nameSuggestionRequestId = 0;
        let userEditedSpotName = false;
        let currentDetailSpotId = null;
        let pendingReviewSpotId = null;
        let selectedCity = citySelect.options[citySelect.selectedIndex].textContent;
        let cityCenter = null;
        let hasSelectedPlace = false;
        let libraryOpen = false;
        const markers = new Map();
        let spots = [];
        let spotTileObserver = null;
        function renderCityOptions() {
          const query = cityPickerSearch.value.trim().toLocaleLowerCase();
          const matchingOptions = Array.from(citySelect.options).slice(1).filter((option) =>
            option.textContent.trim().toLocaleLowerCase().includes(query)
          );
          cityPickerOptions.replaceChildren();
          matchingOptions.forEach((option) => {
            const cityOption = document.createElement("button");
            cityOption.className = "city-picker-option";
            cityOption.type = "button";
            cityOption.role = "option";
            cityOption.textContent = option.textContent;
            cityOption.setAttribute("aria-selected", String(option.value === citySelect.value));
            cityOption.addEventListener("click", () => {
              citySelect.value = option.value;
              citySelect.dispatchEvent(new Event("change"));
            });
            cityPickerOptions.appendChild(cityOption);
          });
          if (matchingOptions.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.className = "city-picker-empty";
            emptyMessage.textContent = "No matching cities.";
            cityPickerOptions.appendChild(emptyMessage);
          }
        }

        function setCityPickerOpen(open) {
          cityPickerMenu.hidden = !open;
          cityPickerTrigger.setAttribute("aria-expanded", String(open));
          if (open) {
            cityPickerSearch.value = "";
            renderCityOptions();
            cityPickerSearch.focus();
          }
        }

        function setLocationStatus(message) {
          locationStatus.textContent = message;
          locationPickerStatus.textContent = message;
        }

        function updateSpotActionSummary() {
          const details = [];
          if (noteInput.value.trim()) details.push("Note added");
          if (pendingSpotPhotos.length) details.push(pendingSpotPhotos.length + " photo" +
            (pendingSpotPhotos.length === 1 ? "" : "s") + " added");
          if (spotReviewNameInput.value.trim() || spotReviewTextInput.value.trim()) {
            details.push("Review added");
          }
          spotActionSummary.textContent = details.length
            ? details.join(" · ") + "."
            : "Note, photos and written review are optional. Reviews are anonymous unless you add your name.";
        }

        function makeSuggestedSpotName(placeName) {
          const base = (placeName || selectedCity || "Nearby place").trim().slice(0, 48).trimEnd();
          const prefix = base.toLocaleLowerCase() + " bench";
          let highestNumber = 0;
          spots.forEach((spot) => {
            const existing = String(spot.name || "");
            if (!existing.toLocaleLowerCase().startsWith(prefix)) return;
            const suffix = existing.slice(base.length);
            const match = suffix.match(/^ bench(\d+)$/i);
            if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
          });
          return base + " bench" + (highestNumber + 1);
        }

        async function saveChange(save) {
          try {
            await save();
          } catch (error) {
            console.error("Could not save changes to the shared bench library.", error);
            window.alert("This change could not be saved to the shared bench library. Check your connection and Supabase setup, then try again.");
            return false;
          }
          return true;
        }

        function markerIcon() {
          return L.divIcon({
            className: "",
            html: '<div class="bench-marker" aria-hidden="true"><span>🪑</span></div>',
            iconSize: [38, 38],
            iconAnchor: [19, 34],
            popupAnchor: [0, -31],
          });
        }

        function formatDate(value) {
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) return "Date not available";
          return new Intl.DateTimeFormat("en-BE", { day: "numeric", month: "short", year: "numeric" }).format(date);
        }

        function addMarker(spot) {
          const marker = L.marker([spot.lat, spot.lng], { icon: markerIcon() }).addTo(map);
          markers.set(spot.id, marker);
          const popup = document.createElement("div");
          const title = document.createElement("div");
          title.className = "popup-title";
          title.textContent = spot.name;
          popup.appendChild(title);
          if (spot.kind) {
            const kind = document.createElement("div");
            kind.className = "popup-note";
            kind.textContent = spot.kind;
            popup.appendChild(kind);
          }
          if (spot.note) {
            const note = document.createElement("div");
            note.className = "popup-note";
            note.textContent = spot.note;
            popup.appendChild(note);
          }
          const reviewSummary = document.createElement("div");
          reviewSummary.className = "popup-note";
          reviewSummary.textContent = reviewSummaryText(spot);
          popup.appendChild(reviewSummary);
          const date = document.createElement("div");
          date.className = "popup-date";
          date.textContent = spot.isSample ? "Sample starter spot" : "Spotted " + formatDate(spot.createdAt);
          popup.appendChild(date);
          const details = document.createElement("button");
          details.className = "popup-details";
          details.type = "button";
          details.textContent = "Reviews & photos";
          details.addEventListener("click", () => openDetails(spot.id));
          popup.appendChild(details);
          if (benchRepository.ownsBench(spot)) {
            const remove = document.createElement("button");
            remove.className = "popup-remove";
            remove.type = "button";
            remove.textContent = "Remove this spot";
            remove.addEventListener("click", () => removeSpot(spot.id));
            popup.appendChild(remove);
          }
          marker.bindPopup(popup);
        }

        function renderList() {
          const nearbyRadiusKm = Number(nearbyRadius.value);
          const citySpots = currentLocation
            ? spots.map((spot) => ({
              spot,
              distance: distanceInKm(
                [currentLocation.lat, currentLocation.lng],
                [spot.lat, spot.lng]
              ),
            })).filter((item) => item.distance <= nearbyRadiusKm)
              .sort((a, b) => a.distance - b.distance)
            : (cityCenter
            ? spots.filter((spot) =>
              distanceInKm(cityCenter, [spot.lat, spot.lng]) <= 12
            )
            : spots).map((spot) => ({ spot }))
              .sort((a, b) => new Date(b.spot.createdAt || 0) - new Date(a.spot.createdAt || 0));
          count.textContent = String(citySpots.length);
          libraryHeading.textContent = currentLocation ? "Nearby places" : "The library";
          libraryCityName.textContent = selectedCity;
          mapCityLabel.textContent = selectedCity;
          if (spotTileObserver) spotTileObserver.disconnect();
          list.replaceChildren();
          if (citySpots.length === 0) {
            const emptyState = document.createElement("div");
            emptyState.className = "empty-state";
            emptyState.textContent = currentLocation
              ? "No benches in the library within " + nearbyRadiusKm + " km yet."
              : "No benches in the library for " + selectedCity + " yet.";
            list.appendChild(emptyState);
            return;
          }

          citySpots.forEach(({ spot, distance }) => {
            const row = document.createElement("button");
            row.className = "spot-row";
            row.type = "button";
            const copy = document.createElement("span");
            copy.className = "spot-copy";
            const title = document.createElement("span");
            title.className = "spot-title";
            title.textContent = spot.name;
            const date = document.createElement("span");
            date.className = "spot-date";
            date.textContent = (spot.kind || "Bench") + " · " +
              (currentLocation ? formatDistance(distance) + " away" :
                (spot.isSample ? "Sample location" : formatDate(spot.createdAt)));
            const rating = document.createElement("span");
            rating.className = "spot-rating";
            rating.textContent = reviewSummaryText(spot);
            copy.append(title, date, rating);
            row.append(copy);
            row.addEventListener("click", () => {
              setLibraryOpen(false);
              map.setView([spot.lat, spot.lng], 17);
              const marker = markers.get(spot.id);
              if (marker) {
                marker.openPopup();
              }
            });
            list.appendChild(row);
          });
          if ("IntersectionObserver" in window &&
              !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            spotTileObserver = new IntersectionObserver((entries) => {
              entries.forEach((entry) => {
                const visibility = Math.min(1, entry.intersectionRatio / 0.75);
                entry.target.style.setProperty("--tile-opacity", String(0.56 + visibility * 0.44));
                entry.target.style.setProperty(
                  "--tile-scroll-offset",
                  ((1 - visibility) * 8) + "px"
                );
              });
            }, {
              threshold: [0, 0.15, 0.3, 0.5, 0.75, 1],
            });
            list.querySelectorAll(".spot-row").forEach((row) => spotTileObserver.observe(row));
          } else {
            spotTileObserver = null;
          }
        }

        function setLibraryOpen(open) {
          libraryOpen = open && hasSelectedPlace;
          suggestionsSection.hidden = !libraryOpen;
          mapWrap.classList.toggle("library-open", libraryOpen);
          libraryButton.setAttribute("aria-expanded", String(libraryOpen));
          if (libraryOpen) map.invalidateSize();
        }

        function showCityPage() {
          hasSelectedPlace = true;
          setLibraryOpen(false);
          document.body.classList.remove("welcome-mode");
          document.body.classList.add("map-mode");
          welcomeScreen.hidden = true;
          cityPage.hidden = false;
          renderList();
          window.scrollTo({ top: 0, behavior: "smooth" });
          window.requestAnimationFrame(() => {
            map.invalidateSize();
            if (currentLocation) {
              map.flyTo([currentLocation.lat, currentLocation.lng], 15);
            } else if (cityCenter) {
              const compactViewport = Math.min(map.getSize().x, map.getSize().y) < 520;
              map.flyTo(cityCenter, compactViewport ? 14 : 13);
            } else {
              map.fitBounds(belgiumBounds);
            }
          });
        }

        function showWelcomeScreen() {
          hasSelectedPlace = false;
          setLibraryOpen(false);
          setAdding(false);
          document.body.classList.add("welcome-mode");
          document.body.classList.remove("map-mode");
          cityPage.hidden = true;
          welcomeScreen.hidden = false;
          citySelect.value = "";
          cityPickerLabel.textContent = "Choose a city…";
          setCityPickerOpen(false);
          renderList();
          window.scrollTo({ top: 0, behavior: "smooth" });
          window.setTimeout(() => cityPickerTrigger.focus(), 250);
        }

        function distanceInKm(first, second) {
          const radians = (degrees) => degrees * Math.PI / 180;
          const latDelta = radians(second[0] - first[0]);
          const lngDelta = radians(second[1] - first[1]);
          const a = Math.sin(latDelta / 2) ** 2 +
            Math.cos(radians(first[0])) * Math.cos(radians(second[0])) * Math.sin(lngDelta / 2) ** 2;
          return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        function formatDistance(kilometers) {
          return kilometers < 1
            ? Math.round(kilometers * 1000) + " m"
            : kilometers.toFixed(1) + " km";
        }

        function locateUser() {
          if (window.isSecureContext === false) {
            setLocationStatus("Location requires a secure connection. Open this site over HTTPS, or use localhost on this device.");
            return;
          }
          if (!navigator.geolocation) {
            setLocationStatus("This browser does not support location. You can still browse the map and add a pin.");
            return;
          }

          locationButtons.forEach((button) => { button.disabled = true; });
          setLocationStatus("Finding your location…");
          const requestId = ++locationRequestId;
          navigator.geolocation.getCurrentPosition((position) => {
            if (requestId !== locationRequestId) return;
            currentLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            cityCenter = null;
            selectedCity = "Nearby benches";
            citySelect.value = "";
            cityPickerLabel.textContent = "Choose a city…";
            const point = [currentLocation.lat, currentLocation.lng];
            if (locationMarker) map.removeLayer(locationMarker);
            locationMarker = L.circleMarker(point, {
              radius: 8,
              color: "#fff4e6",
              weight: 3,
              fillColor: "#854442",
              fillOpacity: 1,
            }).addTo(map).bindTooltip("You are here");
            nearbyOptions.hidden = false;
            addHereButton.hidden = false;
            locationButtons.forEach((button) => {
              button.textContent = "Update location";
              button.disabled = false;
            });
            setLocationStatus("Showing benches within " + nearbyRadius.value +
              " km, nearest first. Your location stays on this device.");
            showCityPage();
          }, (error) => {
            if (requestId !== locationRequestId) return;
            const messages = {
              1: "Location permission was denied. Allow location access in your browser settings, then try again.",
              2: "Your location is unavailable right now. Check your device's location services and try again.",
              3: "Finding your location timed out. Try again when you have a clearer GPS signal.",
            };
            setLocationStatus(messages[error.code] ||
              "Could not find your location. You can still browse the map and add a pin.");
            locationButtons.forEach((button) => { button.disabled = false; });
          }, {
            enableHighAccuracy: true,
            maximumAge: 60000,
            timeout: 15000,
          });
        }

        function reviewSummaryText(spot) {
          const reviews = Array.isArray(spot.reviews) ? spot.reviews : [];
          if (reviews.length === 0) return "No reviews yet";
          const average = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;
          return "★ " + average.toFixed(1) + " · " + reviews.length + (reviews.length === 1 ? " review" : " reviews");
        }

        function renderStars(rating) {
          const value = Number(rating) || 0;
          const stars = document.createElement("span");
          stars.className = "stars";
          stars.setAttribute("aria-label", value + " out of 5 stars");
          stars.textContent = "★".repeat(value) + "☆".repeat(5 - value);
          return stars;
        }

        function openDetails(id) {
          const spot = spots.find((item) => item.id === id);
          if (!spot) return;
          currentDetailSpotId = id;
          const reviews = Array.isArray(spot.reviews) ? spot.reviews : [];
          const detailTitle = document.getElementById("detail-title");
          const detailMeta = document.getElementById("detail-meta");
          const detailRating = document.getElementById("detail-rating");
          const detailPhotos = document.getElementById("detail-photos");
          const reviewList = document.getElementById("review-list");
          detailTitle.textContent = spot.name;
          detailMeta.textContent = (spot.isSample ? "Sample location · " : "") +
            (spot.kind || "Bench") + " · " + (spot.isSample ? "Starter data" : "Spotted " + formatDate(spot.createdAt)) +
            (spot.note ? " · " + spot.note : "");
          detailRating.replaceChildren();
          if (reviews.length) {
            const average = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;
            const score = document.createElement("strong");
            score.textContent = average.toFixed(1);
            detailRating.append(score, renderStars(Math.round(average)));
          } else {
            const firstReview = document.createElement("span");
            firstReview.className = "review-count";
            firstReview.textContent = "No ratings yet";
            detailRating.appendChild(firstReview);
          }
          const reviewCount = document.createElement("span");
          reviewCount.className = "review-count";
          reviewCount.textContent = reviews.length + (reviews.length === 1 ? " review" : " reviews");
          detailRating.appendChild(reviewCount);

          detailPhotos.replaceChildren();
          reviews.forEach((review) => (Array.isArray(review.photos) ? review.photos : []).forEach((photo) => {
            const image = document.createElement("img");
            image.className = "detail-photo";
            image.src = photo;
            image.alt = "Photo shared in a bench review";
            detailPhotos.appendChild(image);
          }));

          reviewList.replaceChildren();
          if (reviews.length === 0) {
            const empty = document.createElement("div");
            empty.className = "detail-empty";
            empty.textContent = "No reviews yet. Share what this bench is like for the next person.";
            reviewList.appendChild(empty);
          } else {
            [...reviews].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).forEach((review) => {
              const card = document.createElement("article");
              card.className = "review-card";
              const top = document.createElement("div");
              top.className = "review-card-top";
              const author = document.createElement("span");
              author.className = "review-author";
              author.textContent = review.author || "Community member";
              top.append(author, renderStars(Number(review.rating) || 0));
              const date = document.createElement("div");
              date.className = "review-date";
              date.textContent = formatDate(review.createdAt);
              card.append(top, date);
              if (review.text) {
                const text = document.createElement("p");
                text.className = "review-text";
                text.textContent = review.text;
                card.appendChild(text);
              }
              if (Array.isArray(review.photos) && review.photos.length) {
                const photos = document.createElement("div");
                photos.className = "review-photos";
                review.photos.forEach((photo, index) => {
                  const image = document.createElement("img");
                  image.className = "review-photo";
                  image.src = photo;
                  image.alt = "Review photo " + (index + 1);
                  photos.appendChild(image);
                });
                card.appendChild(photos);
              }
              reviewList.appendChild(card);
            });
          }
          if (!detailDialog.open) detailDialog.showModal();
        }

        function setAdding(value) {
          adding = value;
          addButton.setAttribute("aria-pressed", String(value));
          addButton.innerHTML = value
            ? '<span class="plus" aria-hidden="true">×</span> Cancel spotting'
            : '<span class="plus" aria-hidden="true">+</span> Spot a bench';
          hint.classList.toggle("visible", value);
          map.getContainer().style.cursor = value ? "crosshair" : "";
        }

        function openForm(location) {
          pendingLocation = location;
          pendingPlaceName = selectedCity;
          userEditedSpotName = false;
          const requestId = ++nameSuggestionRequestId;
          coordinates.textContent = location.lat.toFixed(5) + ", " + location.lng.toFixed(5);
          form.reset();
          spotNoteForm.reset();
          spotReviewForm.reset();
          clearSpotPhotoPreviews();
          const fallbackName = makeSuggestedSpotName(selectedCity);
          nameInput.value = fallbackName;
          nameHelp.textContent = "Looking for a nearby place name. You can edit this suggestion.";
          updateSpotActionSummary();
          dialog.showModal();
          window.setTimeout(() => nameInput.focus(), 0);
          placeNameService.lookup(location).then((placeName) => {
            if (!dialog.open || requestId !== nameSuggestionRequestId || !placeName) return;
            pendingPlaceName = placeName;
            if (!userEditedSpotName) {
              nameInput.value = makeSuggestedSpotName(placeName);
            }
            nameHelp.textContent = userEditedSpotName
              ? "Nearby place found. Your name is unchanged."
              : "Suggested from the nearby place. Edit it to use a unique name.";
          }).catch((error) => {
            if (!dialog.open || requestId !== nameSuggestionRequestId) return;
            console.error("Could not look up a nearby place name.", error);
            nameHelp.textContent = "Nearby name lookup failed; the suggested city name is ready to edit.";
          });
        }

        async function removeSpot(id) {
          if (!await saveChange(() => benchRepository.deleteBench(id))) {
            return;
          }
          spots = spots.filter((spot) => spot.id !== id);
          const marker = markers.get(id);
          if (marker) map.removeLayer(marker);
          markers.delete(id);
          if (currentDetailSpotId === id) detailDialog.close();
          renderList();
        }

        citySelect.addEventListener("change", () => {
          const selectedOption = citySelect.options[citySelect.selectedIndex];
          cityPickerLabel.textContent = selectedOption.textContent;
          setCityPickerOpen(false);
          locationRequestId += 1;
          locationButtons.forEach((button) => { button.disabled = false; });
          currentLocation = null;
          if (locationMarker) {
            map.removeLayer(locationMarker);
            locationMarker = null;
          }
          nearbyOptions.hidden = true;
          addHereButton.hidden = true;
          locationButtons.forEach((button) => { button.textContent = "Use my location"; });
          setLocationStatus("");
          if (!citySelect.value) {
            cityCenter = null;
            selectedCity = "Choose a city";
            showWelcomeScreen();
            return;
          }
          if (citySelect.value === "belgium") {
            selectedCity = "Belgium";
            cityCenter = null;
          } else {
            selectedCity = citySelect.options[citySelect.selectedIndex].textContent;
            const [lat, lng] = citySelect.value.split(",").map(Number);
            cityCenter = [lat, lng];
          }
          showCityPage();
        });

        cityPickerTrigger.addEventListener("click", () => {
          setCityPickerOpen(cityPickerMenu.hidden);
        });
        cityPickerSearch.addEventListener("input", renderCityOptions);
        cityPickerSearch.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const firstOption = cityPickerSearch.value.trim()
              ? cityPickerOptions.querySelector(".city-picker-option")
              : null;
            if (firstOption) firstOption.click();
          } else if (event.key === "Escape") {
            setCityPickerOpen(false);
            cityPickerTrigger.focus();
          }
        });
        document.addEventListener("click", (event) => {
          if (!cityPicker.contains(event.target)) setCityPickerOpen(false);
        });

        changeCityButton.addEventListener("click", showWelcomeScreen);
        libraryButton.addEventListener("click", () => {
          if (!libraryOpen) setAdding(false);
          setLibraryOpen(!libraryOpen);
        });
        closeLibraryButton.addEventListener("click", () => setLibraryOpen(false));
        refreshLibraryButton.addEventListener("click", () => loadSpots());
        locateButton.addEventListener("click", locateUser);
        mapLocateButton.addEventListener("click", locateUser);
        addHereButton.addEventListener("click", () => {
          if (currentLocation) openForm(currentLocation);
        });
        nearbyRadius.addEventListener("change", () => {
          if (!currentLocation) return;
          setLocationStatus("Showing benches within " + nearbyRadius.value +
            " km, nearest first. Your location stays on this device.");
          renderList();
        });

        addButton.addEventListener("click", () => {
          if (adding) {
            setAdding(false);
            return;
          }
          setLibraryOpen(false);
          setAdding(true);
          map.invalidateSize();
        });
        map.on("click", (event) => {
          if (adding) setAdding(false);
          openForm(event.latlng);
        });

        document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
        document.getElementById("cancel-dialog").addEventListener("click", () => dialog.close());
        dialog.addEventListener("click", (event) => {
          if (event.target === dialog && !document.getElementById("close-dialog").disabled) {
            dialog.close();
          }
        });
        document.getElementById("open-note-action").addEventListener("click", () => spotNoteDialog.showModal());
        document.getElementById("open-photos-action").addEventListener("click", () => spotPhotosDialog.showModal());
        document.getElementById("open-review-action").addEventListener("click", () => spotReviewDialog.showModal());
        nameInput.addEventListener("input", () => { userEditedSpotName = true; });
        document.getElementById("close-spot-note").addEventListener("click", () => spotNoteDialog.close());
        document.getElementById("close-spot-photos").addEventListener("click", () => spotPhotosDialog.close());
        document.getElementById("close-spot-review").addEventListener("click", () => spotReviewDialog.close());
        document.getElementById("save-spot-photos").addEventListener("click", () => spotPhotosDialog.close());
        spotNoteForm.addEventListener("submit", (event) => {
          event.preventDefault();
          spotNoteDialog.close();
          updateSpotActionSummary();
        });
        spotReviewForm.addEventListener("submit", (event) => {
          event.preventDefault();
          spotReviewDialog.close();
          updateSpotActionSummary();
        });
        spotReviewPhotoInput.addEventListener("change", () => addSelectedSpotPhotos(spotReviewPhotoInput));
        spotCameraPhotoInput.addEventListener("change", () => addSelectedSpotPhotos(spotCameraPhotoInput));
        spotReviewNameInput.addEventListener("input", updateSpotActionSummary);
        spotReviewTextInput.addEventListener("input", updateSpotActionSummary);
        noteInput.addEventListener("input", updateSpotActionSummary);
        dialog.addEventListener("close", () => {
          nameSuggestionRequestId += 1;
          pendingLocation = null;
          form.reset();
          spotNoteForm.reset();
          spotReviewForm.reset();
          clearSpotPhotoPreviews();
          spotSubmitButton.disabled = false;
          spotSubmitButton.textContent = "Add spot";
          document.getElementById("close-dialog").disabled = false;
          document.getElementById("cancel-dialog").disabled = false;
        });

        document.getElementById("close-detail").addEventListener("click", () => detailDialog.close());
        document.getElementById("close-detail-bottom").addEventListener("click", () => detailDialog.close());
        document.getElementById("add-review-button").addEventListener("click", () => {
          const spot = spots.find((item) => item.id === currentDetailSpotId);
          if (!spot) return;
          pendingReviewSpotId = spot.id;
          document.getElementById("review-bench-name").textContent = "For " + spot.name;
          reviewForm.reset();
          clearReviewPhotoPreviews();
          reviewDialog.showModal();
          window.setTimeout(() => document.getElementById("review-text").focus(), 0);
        });
        document.getElementById("close-review").addEventListener("click", () => reviewDialog.close());
        document.getElementById("cancel-review").addEventListener("click", () => reviewDialog.close());
        reviewDialog.addEventListener("close", () => {
          pendingReviewSpotId = null;
          reviewForm.reset();
          reviewSubmitButton.disabled = false;
          reviewSubmitButton.textContent = "Post review";
          clearReviewPhotoPreviews();
          document.getElementById("close-review").disabled = false;
          document.getElementById("cancel-review").disabled = false;
        });

        reviewForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const spot = spots.find((item) => item.id === pendingReviewSpotId);
          if (!spot) return;
          const selectedRating = reviewForm.querySelector('input[name="rating"]:checked');
          const author = reviewNameInput.value.trim();
          const text = reviewTextInput.value.trim();
          const photos = Array.from(reviewPhotoInput.files || []).slice(0, 3);
          let processedPhotos;
          reviewSubmitButton.disabled = true;
          reviewSubmitButton.textContent = "Preparing photos…";
          try {
            processedPhotos = await Promise.all(photos.map((photo) => PhotoTools.resize(photo)));
          } catch (error) {
            if (!reviewDialog.open || pendingReviewSpotId !== spot.id) return;
            console.error("Could not process bench review photos.", error);
            reviewSubmitButton.disabled = false;
            reviewSubmitButton.textContent = "Post review";
            window.alert(error.message);
            return;
          }
          if (!reviewDialog.open || pendingReviewSpotId !== spot.id) return;
          const review = {
            id: window.crypto && typeof window.crypto.randomUUID === "function"
              ? window.crypto.randomUUID()
              : String(Date.now()) + "-" + Math.random().toString(36).slice(2),
            author: author || "Anonymous",
            rating: Number(selectedRating.value),
            text,
            photos: processedPhotos,
            createdAt: new Date().toISOString(),
          };
          const previousReviews = Array.isArray(spot.reviews) ? spot.reviews : [];
          spot.reviews = [...previousReviews, review];
          reviewSubmitButton.textContent = "Saving review…";
          document.getElementById("close-review").disabled = true;
          document.getElementById("cancel-review").disabled = true;
          if (!await saveChange(() => benchRepository.addReview(spot.id, review))) {
            spot.reviews = previousReviews;
            reviewSubmitButton.disabled = false;
            reviewSubmitButton.textContent = "Post review";
            document.getElementById("close-review").disabled = false;
            document.getElementById("cancel-review").disabled = false;
            return;
          }
          reviewSubmitButton.disabled = false;
          reviewSubmitButton.textContent = "Post review";
          reviewDialog.close();
          openDetails(spot.id);
          renderList();
          const marker = markers.get(spot.id);
          if (marker) {
            const popup = marker.getPopup();
            if (popup && popup.isOpen()) {
              const popupContent = popup.getContent();
              if (popupContent instanceof HTMLElement) {
                const notes = popupContent.querySelectorAll(".popup-note");
                if (notes.length) notes[notes.length - 1].textContent = reviewSummaryText(spot);
              }
            }
          }
        });

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!pendingLocation) return;
          const spotName = nameInput.value.trim() || makeSuggestedSpotName(pendingPlaceName);
          const reviewAuthor = spotReviewNameInput.value.trim() || "Anonymous";
          const reviewText = spotReviewTextInput.value.trim();
          const selectedRating = form.querySelector('input[name="spot-rating"]:checked');
          const location = pendingLocation;
          const photos = pendingSpotPhotos.slice(0, 3);
          let processedPhotos;
          spotSubmitButton.disabled = true;
          spotSubmitButton.textContent = "Preparing photos…";
          try {
            processedPhotos = await Promise.all(photos.map((photo) => PhotoTools.resize(photo)));
          } catch (error) {
            if (!dialog.open || pendingLocation !== location) return;
            console.error("Could not process first-review photos.", error);
            spotSubmitButton.disabled = false;
            spotSubmitButton.textContent = "Add spot";
            window.alert(error.message);
            return;
          }
          if (!dialog.open || pendingLocation !== location) return;
          const spot = {
            id: window.crypto && typeof window.crypto.randomUUID === "function"
              ? window.crypto.randomUUID()
              : String(Date.now()) + "-" + Math.random().toString(36).slice(2),
            name: spotName,
            kind: kindInput.value,
            note: noteInput.value.trim(),
            lat: location.lat,
            lng: location.lng,
            createdAt: new Date().toISOString(),
            reviews: [{
              id: window.crypto && typeof window.crypto.randomUUID === "function"
                ? window.crypto.randomUUID()
                : String(Date.now()) + "-" + Math.random().toString(36).slice(2),
              author: reviewAuthor,
              rating: Number(selectedRating.value),
              text: reviewText,
              photos: processedPhotos,
              createdAt: new Date().toISOString(),
            }],
          };
          spots = [spot, ...spots];
          spotSubmitButton.textContent = "Saving spot…";
          document.getElementById("close-dialog").disabled = true;
          document.getElementById("cancel-dialog").disabled = true;
          if (!await saveChange(() => benchRepository.addBench(spot))) {
            spots = spots.filter((item) => item.id !== spot.id);
            document.getElementById("close-dialog").disabled = false;
            document.getElementById("cancel-dialog").disabled = false;
            spotSubmitButton.disabled = false;
            spotSubmitButton.textContent = "Add spot";
            return;
          }
          addMarker(spot);
          renderList();
          dialog.close();
          markers.get(spot.id).openPopup();
        });

        dialog.addEventListener("cancel", (event) => {
          if (document.getElementById("close-dialog").disabled) event.preventDefault();
        });
        reviewDialog.addEventListener("cancel", (event) => {
          if (document.getElementById("close-review").disabled) event.preventDefault();
        });

        async function loadSpots() {
          addButton.disabled = true;
          refreshLibraryButton.disabled = true;
          storageStatus.hidden = false;
          storageStatus.textContent = "Connecting to the shared bench library…";
          try {
            const savedSpots = await benchRepository.load();
            spots = savedSpots.filter((spot) =>
              spot && typeof spot.id === "string" &&
              typeof spot.name === "string" &&
              typeof spot.lat === "number" && Number.isFinite(spot.lat) &&
              typeof spot.lng === "number" && Number.isFinite(spot.lng)
            );
            markers.forEach((marker) => map.removeLayer(marker));
            markers.clear();
            spots.forEach(addMarker);
            renderList();
            storageStatus.hidden = true;
            addButton.disabled = false;
            refreshLibraryButton.disabled = false;
          } catch (error) {
            console.error("Could not load the shared bench library.", error);
            storageStatus.textContent = "Could not connect to the shared bench library. Configure the Supabase URL and anon key in js/supabase-config.js, then start this app with `python server.py`.";
            addButton.disabled = false;
            refreshLibraryButton.disabled = false;
          }
          window.setTimeout(() => map.invalidateSize(), 0);
        }

        loadSpots();
      })();
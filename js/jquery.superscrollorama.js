/*
	SUPERSCROLLORAMA - The jQuery plugin for doing scroll animations
	by John Polacek (@johnpolacek)

	Powered by the Greensock Tweening Platform
	http://www.greensock.com
	Greensock License info at http://www.greensock.com/licensing/

	Dual licensed under MIT and GPL.

	Thanks to Jan Paepke (@janpaepke) for making many nice improvements
*/

(function($) {

	$.superscrollorama = function(options) {

		var superscrollorama = {};
		var defaults = {
			//¿Nos desplazamos vertical u horizontalmente?
			// are we scrolling vertically or horizontally?
			isVertical:true,
      // la animación se activa cuando el origen del Elemento respectivo se encuentra en el centro de la scrollarea. Esto se puede cambiar aquí para estar en el borde (-> falso)
	    // the animation triggers when the respective Element's origin is in the center of the scrollarea. This can be changed here to be at the edge (-> false)
	    triggerAtCenter: true,
      // al desplazarse más allá de la animación, ¿deberían reproducirse (verdadero) o simplemente saltar al último fotograma respectivo (falso)? No afecta las animaciones donde duration = 0
			// when scrolling past the animation should they be played out (true) or just be jumped to the respective last frame (false)? Does not affect animations where duration = 0
			playoutAnimations: true,
      //hacer la configuración inversa para que no tenga que pasarla por cada interpolación para revertir globalmente
			// make reverse configurable so you don't have to pass it in for every tween to reverse globally
			reverse: true
		};
		superscrollorama.settings = $.extend({}, defaults, options);
        var $window = $(window);

		// PRIVATE VARS

		var animObjects = [],
			pinnedObjects = [],
			scrollContainerOffset = {x: 0, y: 0},
			doUpdateOnNextTick = false,
			targetOffset,
			i;

		// PRIVATE FUNCTIONS

		function init() {
			// establecer controladores de eventos
			// set event handlers
			$window.scroll(function() {
				doUpdateOnNextTick = true;
			});
			TweenLite.ticker.addEventListener("tick", tickHandler);
		}

		// devuelve 0 cuando el valor es automático
		// return 0 when value is auto
		function cssNumericPosition ($elem) {
			var obj = {
				top: parseFloat($elem.css("top")),
				left: parseFloat($elem.css("left"))
			};
			if (isNaN(obj.top)) {
				obj.top = 0;
			}
			if (isNaN(obj.left)) {
				obj.left = 0;
			}
			return obj;
		}

		function tickHandler() {
			if (doUpdateOnNextTick) {
				checkScrollAnim();
				doUpdateOnNextTick = false;
			}
		}

		// restablecer un objeto pin
		// reset a pin Object
		function resetPinObj (pinObj) {
			pinObj.el.css('position', pinObj.origPositioning.pos);
			pinObj.el.css('top', pinObj.origPositioning.top);
			pinObj.el.css('left', pinObj.origPositioning.left);
		}
		// establece un Tween Progress (use totalProgress para TweenMax y TimelineMax para incluir repeticiones)
		// set a Tween Progress (use totalProgress for TweenMax and TimelineMax to include repeats)
		function setTweenProgress(tween, progress) {
			if (tween) {
				if (tween.totalProgress) {
					tween.totalProgress(progress).pause();
				} else {
					tween.progress(progress).pause();
				}
			}
		}

		function checkScrollAnim() {

			var currScrollPoint = superscrollorama.settings.isVertical ? $window.scrollTop() + scrollContainerOffset.y :  $window.scrollLeft() + scrollContainerOffset.x;
			var offsetAdjust = superscrollorama.settings.triggerAtCenter ? (superscrollorama.settings.isVertical ? - $window.height()/2 : - $window.width()/2) : 0;
			var i, startPoint, endPoint;

			// verifica todos los animObjects
			// check all animObjects
			var numAnim = animObjects.length;
			for (i=0; i<numAnim; i++) {
				var animObj = animObjects[i],
					target = animObj.target,
					offset = animObj.offset;

				if (typeof(target) === 'string') {
                    targetOffset = $(target).offset() || {};
					startPoint = superscrollorama.settings.isVertical ? targetOffset.top + scrollContainerOffset.y : targetOffset.left + scrollContainerOffset.x;
					offset += offsetAdjust;
				} else if (typeof(target) === 'number')	{
					startPoint = target;
				} else if ($.isFunction(target)) {
					startPoint = target.call(this);
				} else {
                    targetOffset = target.offset();
                    startPoint = superscrollorama.settings.isVertical ? targetOffset.top + scrollContainerOffset.y : targetOffset.left + scrollContainerOffset.x;
					offset += offsetAdjust;
				}

				startPoint += offset;

        // si la duración es 0, la animación debería reproducirse automáticamente (avanzando desde ANTES a DESPUÉS y retrocediendo desde DESPUÉS a ANTES)
				// if the duration is 0 the animation should autoplay (forward going from BEFORE to AFTER and reverse going from AFTER to BEFORE)
				endPoint = startPoint + animObj.dur;

				if ((currScrollPoint > startPoint && currScrollPoint < endPoint) && animObj.state !== 'TWEENING') {
					// si debería ser TWEENING y no es ...
					// if it should be TWEENING and isn't..
					animObj.state = 'TWEENING';
					animObj.start = startPoint;
					animObj.end = endPoint;
				}
				if (currScrollPoint < startPoint && animObj.state !== 'BEFORE' && animObj.reverse) {
					// si debería estar en el estado ANTES de tween y no es ...
					// if it should be at the BEFORE tween state and isn't..
					if (superscrollorama.settings.playoutAnimations || animObj.dur === 0) {
						animObj.tween.reverse();
					} else {
						setTweenProgress(animObj.tween, 0);
					}
					animObj.state = 'BEFORE';
				} else if (currScrollPoint > endPoint && animObj.state !== 'AFTER') {
					// si debería estar en el estado AFTER Tween y no es ...
					// if it should be at the AFTER tween state and isn't..
					if (superscrollorama.settings.playoutAnimations || animObj.dur === 0) {
						animObj.tween.play();
					} else {
						setTweenProgress(animObj.tween, 1);
					}
					animObj.state = 'AFTER';
				} else if (animObj.state === 'TWEENING') {
          // si es TWEENING ...
					// if it is TWEENING..
					var repeatIndefinitely = false;
					if (animObj.tween.repeat) {
						// tiene la interpolación la opción de repetición (TweenMax / TimelineMax)
						// does the tween have the repeat option (TweenMax / TimelineMax)
						repeatIndefinitely = (animObj.tween.repeat() === -1);
					}


					// si la animación gira indefinidamente, solo se reproducirá durante el tiempo de la duración
					// if the animation loops indefinitely it will just play for the time of the duration
					if (repeatIndefinitely) {
            // no hay ningún valor "isPlaying", por lo que debemos guardar la cabeza lectora para determinar si la animación se está ejecutando
						// there is no "isPlaying" value so we need to save the playhead to determine whether the animation is running
						var playheadPosition = animObj.tween.totalProgress();
						if (animObj.playeadLastPosition === null || playheadPosition === animObj.playeadLastPosition) {
							if (playheadPosition === 1) {
								if (animObj.tween.yoyo()) {
                  // La reproducción inversa con interpolaciones infinitamente enlazadas solo funciona con yoyo verdadero
									// reverse Playback with infinitely looped tweens only works with yoyo true
									animObj.tween.reverse();
								} else {
									animObj.tween.totalProgress(0).play();
								}
							} else {
								animObj.tween.play();
							}
						}
						animObj.playeadLastPosition = playheadPosition;
					} else {
						setTweenProgress(animObj.tween, (currScrollPoint - animObj.start)/(animObj.end - animObj.start));
					}
				}
			}


			// verifica todos los elementos anclados
			// check all pinned elements
			var numPinned = pinnedObjects.length;
			for (i=0; i<numPinned; i++) {
				var pinObj = pinnedObjects[i];
				var el = pinObj.el;


				// ¿debería pincharse (o actualizarse) el objeto?
				// should object be pinned (or updated)?
				if (pinObj.state !== 'PINNED') {

                    var pinObjSpacerOffset = pinObj.spacer.offset();

					if (pinObj.state === 'UPDATE') {
						resetPinObj(pinObj);
            // volver a la posición original para que startPoint y endPoint se calculen con los valores correctos
						// revert to original Position so startPoint and endPoint will be calculated to the correct values
					}

					startPoint = superscrollorama.settings.isVertical ? pinObjSpacerOffset.top + scrollContainerOffset.y : pinObjSpacerOffset.left + scrollContainerOffset.x;
					startPoint += pinObj.offset;
					endPoint = startPoint + pinObj.dur;

					var jumpedPast = ((currScrollPoint > endPoint && pinObj.state === 'BEFORE') || (currScrollPoint < startPoint && pinObj.state === 'AFTER')); // if we jumped past a pinarea (i.e. when refreshing or using a function) we need to temporarily pin the element so it gets positioned to start or end respectively
					var inPinAra = (currScrollPoint > startPoint && currScrollPoint < endPoint);
					if (inPinAra || jumpedPast) {
            // establece valores de posición originales para desanclar
						// set original position values for unpinning
						if (pinObj.pushFollowers && el.css('position') === "static") {

							// esto no puede ser Si queremos pasar los siguientes elementos, necesitamos al menos permitir el posicionamiento relativo
							// this can't be. If we want to pass following elements we need to at least allow relative positioning
							el.css('position', "relative");
						}

            // guardar el posicionamiento original
						// save original positioning
						pinObj.origPositioning = {
							pos: el.css('position'),
							top: pinObj.spacer.css('top'),
							left: pinObj.spacer.css('left')
						};

            // cambiar a una posición fija
						// change to fixed position
						pinObj.fixedPositioning = {
							top: superscrollorama.settings.isVertical ? -pinObj.offset : pinObjSpacerOffset.top,
							left: superscrollorama.settings.isVertical ? pinObjSpacerOffset.left : -pinObj.offset
						};
						el.css('position','fixed');
						el.css('will-change','top');
						el.css('top', pinObj.fixedPositioning.top);
						el.css('left', pinObj.fixedPositioning.left);


						// guardar valores
						// save values
						pinObj.pinStart = startPoint;
						pinObj.pinEnd = endPoint;


						// Si queremos empujar hacia abajo los siguientes elementos, necesitamos un espaciador para hacerlo, mientras y después de que nuestro elemento sea reparado.
						// If we want to push down following Items we need a spacer to do it, while and after our element is fixed.
						if (pinObj.pushFollowers) {
							if (superscrollorama.settings.isVertical) {
									pinObj.spacer.height(pinObj.dur + el.outerHeight(true));
							} else {
									pinObj.spacer.width(pinObj.dur + el.outerWidth(true));
							}
						} else {
							if (pinObj.origPositioning.pos === "absolute") { // no spacer
								pinObj.spacer.width(0);
								pinObj.spacer.height(0);

                // spacer necesita reservar el espacio de los elementos, mientras está inmovilizado
								// spacer needs to reserve the elements space, while pinned
							} else {
								if (superscrollorama.settings.isVertical) {
									pinObj.spacer.height(el.outerHeight(true));
								} else {
									pinObj.spacer.width(el.outerWidth(true));
								}
							}
						}


						if (pinObj.state === "UPDATE") {
							if (pinObj.anim) {

                // restablecer el progreso; de lo contrario, la animación no se actualizará a la nueva posición
								// reset the progress, otherwise the animation won't be updated to the new position
								setTweenProgress(pinObj.anim, 0);
							}
						} else if (pinObj.onPin) {
							pinObj.onPin(pinObj.state === "AFTER");
						}

						// pin it!
						pinObj.state = 'PINNED';
					}
				}
        // Si el estado cambió a anclado (o ya lo estaba) necesitamos ubicar el elemento
				// If state changed to pinned (or already was) we need to position the element
				if (pinObj.state === 'PINNED') {
					// Verifica si el objeto debe ser desanclado
					// Check to see if object should be unpinned
					if (currScrollPoint < pinObj.pinStart || currScrollPoint > pinObj.pinEnd) {
            // desanclarlo
						// unpin it
						var before = currScrollPoint < pinObj.pinStart;
						pinObj.state = before ? 'BEFORE' : 'AFTER';
						// establece la animación para finalizar o comenzar
						// set Animation to end or beginning
						setTweenProgress(pinObj.anim, before ? 0 : 1);

						var spacerSize = before ? 0 : pinObj.dur;

						if (superscrollorama.settings.isVertical) {
							pinObj.spacer.height(pinObj.pushFollowers ? spacerSize : 0);
						} else {
							pinObj.spacer.width(pinObj.pushFollowers ? spacerSize : 0);
						}


						// valores correctos si el Objeto pin se movió (animó) durante el PIN (los valores pinObj.el.css nunca serán automáticos ya que la clase los establece)
						// correct values if pin Object was moved (animated) during PIN (pinObj.el.css values will never be auto as they are set by the class)
						var deltay = pinObj.fixedPositioning.top - cssNumericPosition(pinObj.el).top;
						var deltax = pinObj.fixedPositioning.left - cssNumericPosition(pinObj.el).left;


            // primero revertir a los valores de inicio
						// first revert to start values
						resetPinObj(pinObj);


            // elemento de posición correctamente
						// position element correctly
						if (!pinObj.pushFollowers || pinObj.origPositioning.pos === "absolute") {
							var pinOffset;

							// position relative and pushFollowers = false
							if (pinObj.origPositioning.pos === "relative") {
								pinOffset = superscrollorama.settings.isVertical ?
											parseFloat(pinObj.origPositioning.top) :
											parseFloat(pinObj.origPositioning.left);

                // si Position fue "auto" parseFloat resultará en NaN.
								// if Position was "auto" parseFloat will result in NaN
								if (isNaN(pinOffset)) {
									pinOffset = 0;
								}
							} else {
								pinOffset = superscrollorama.settings.isVertical ?
											pinObj.spacer.position().top :
											pinObj.spacer.position().left;
							}

							var direction = superscrollorama.settings.isVertical ?
											"top" :
											"left";

							pinObj.el.css(direction, pinOffset + spacerSize);
						}
            // si position relative y pushFollowers son verdaderos, el elemento permanece intacto.
						// if position relative and pushFollowers is true the element remains untouched.


            // ahora corrige los valores si han sido cambiados durante el pin
						// now correct values if they have been changed during pin
						if (deltay !== 0) {
							pinObj.el.css("top", cssNumericPosition(pinObj.el).top - deltay);
						}
						if (deltax !== 0) {
							pinObj.el.css("left", cssNumericPosition(pinObj.el).left - deltax);
						}
						if (pinObj.onUnpin) {
							pinObj.onUnpin(!before);
						}
					} else if (pinObj.anim) {

            // hacer animación
						// do animation
						setTweenProgress(pinObj.anim, (currScrollPoint - pinObj.pinStart)/(pinObj.pinEnd - pinObj.pinStart));
					}
				}
			}
		}

		// PUBLIC FUNCTIONS
		superscrollorama.addTween = function(target, tween, dur, offset, reverse) {

			tween.pause();

			animObjects.push({
				target:target,
				tween: tween,
				offset: offset || 0,
				dur: dur || 0,
				reverse: (typeof reverse !== "undefined") ? reverse : superscrollorama.settings.reverse, // determine if reverse animation has been disabled
				state:'BEFORE'
			});

			return superscrollorama;
		};

		superscrollorama.pin = function(el, dur, vars) {
			if (typeof(el) === 'string') {
				el = $(el);
			}
			var defaults = {
				offset: 0,

        // si los siguientes elementos verdaderos se "presionarán" hacia abajo, si es falso, el elemento anclado se desplazará hacia ellos
				// if true following elements will be "pushed" down, if false the pinned element will just scroll past them
				pushFollowers: true
			};
			vars = $.extend({}, defaults, vars);
			if (vars.anim) {
				vars.anim.pause();
			}

			var spacer = $('<div class="superscrollorama-pin-spacer"></div>');
			spacer.css("position", "relative");
			spacer.css("top", el.css("top"));
			spacer.css("left", el.css("left"));
			el.before(spacer);

			pinnedObjects.push({
				el:el,
				state:'BEFORE',
				dur:dur,
				offset: vars.offset,
				anim:vars.anim,
				pushFollowers:vars.pushFollowers,
				spacer:spacer,
				onPin:vars.onPin,
				onUnpin:vars.onUnpin
			});
			return superscrollorama;
		};


    //Actualiza un objeto anclado. dur y vars son opcionales para cambiar solo vars y mantener dur pasar NULL para du
		// Update a Pinned object. dur and vars are optional to only change vars and keep dur just pass NULL for dur
		superscrollorama.updatePin = function (el, dur, vars) {
			if (typeof(el) === 'string') {
				el = $(el);
			}
			if (vars.anim) {
				vars.anim.pause();
			}

			var numPinned = pinnedObjects.length;

			for (i=0; i<numPinned; i++) {
				var pinObj = pinnedObjects[i];
				if (el.get(0) === pinObj.el.get(0)) {

					if (dur) {
						pinObj.dur = dur;
					}
					if (vars.anim) {
						pinObj.anim = vars.anim;
					}
					if (vars.offset) {
						pinObj.offset = vars.offset;
					}
					if (typeof vars.pushFollowers !== "undefined") {
						pinObj.pushFollowers = vars.pushFollowers;
					}
					if (vars.onPin) {
						pinObj.onPin = vars.onPin;
					}
					if (vars.onUnpin) {
						pinObj.onUnpin = vars.onUnpin;
					}

          // ¡esto requiere una actualización inmediata!
					// this calls for an immediate update!
					if ((dur || vars.anim || vars.offset) && pinObj.state === 'PINNED') {
						pinObj.state = 'UPDATE';
						checkScrollAnim();
					}
				}
			}
			return superscrollorama;
		};

		superscrollorama.removeTween = function (target, tween, reset) {
			var count = animObjects.length;
			if (typeof reset === "undefined") {
				reset = true;
			}
			for (var index = 0; index < count; index++) {
				var value = animObjects[index];
				if (value.target === target &&
          // tween es opcional. si no se establece simplemente eliminar el elemento
					// tween is optional. if not set just remove element
					(!tween || value.tween === tween)) {
					animObjects.splice(index,1);
					if (reset) {
						setTweenProgress(value.tween, 0);
					}
					count--;
					index--;
				}
			}
			return superscrollorama;
		};

		superscrollorama.removePin = function (el, reset) {
			if (typeof(el) === 'string') {
				el = $(el);
			}
			if (typeof reset === "undefined") {
				reset = true;
			}
			var count = pinnedObjects.length;
			for (var index = 0; index < count; index++) {
				var value = pinnedObjects[index];
				if (value.el.is(el)) {
					pinnedObjects.splice(index,1);
					if (reset) {
						value.spacer.remove();
						resetPinObj(value);
						if (value.anim) {
							setTweenProgress(value.anim, 0);
						}
					}
					count--;
					index--;
				}
			}
			return superscrollorama;
		};

		superscrollorama.setScrollContainerOffset = function (x, y) {
			scrollContainerOffset.x = x;
			scrollContainerOffset.y = y;
			return superscrollorama;
		};

		// si es verdad de manera inmediata, se actualizará en este momento; si es falso, esperará hasta el próximo tweenmax tic. el predeterminado es falso
		// if immedeately is true it will be updated right now, if false it will wait until next tweenmax tick. default is false
		superscrollorama.triggerCheckAnim = function (immediately) {
			if (immediately) {
				checkScrollAnim();
			} else {
				doUpdateOnNextTick = true;
			}
			return superscrollorama;
		};


		// INIT
		init();

		return superscrollorama;
	};

})(jQuery);

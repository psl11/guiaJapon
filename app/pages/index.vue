<template>
  <!--
    «/» = el hogar de la guía: el viaje por defecto es 'japon' (hardcodeado). Un viaje futuro
    vivirá en /trips/<slug> sin tocar este home. TripView llama a useTrip('japon') y posee todo.
    Sin <NuxtLink to="/trips/…">: crawlLinks prerenderizaría una ruta duplicada. Navegación por anclas.
  -->
  <TripView slug="japon" />
</template>

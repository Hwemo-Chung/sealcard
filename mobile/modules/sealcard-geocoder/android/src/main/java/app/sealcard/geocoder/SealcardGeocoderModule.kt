package app.sealcard.geocoder

import android.location.Geocoder
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Locale

/**
 * The fields of expo-location's reverse-geocode result that the place stamp uses
 * (expo-location records/LocationResults.kt ReverseGeocodeResponse), in the
 * requested language.
 */
internal class LocalizedPlace(
  @Field var city: String?,
  @Field var district: String?,
  @Field var street: String?,
  @Field var region: String?,
  @Field var subregion: String?,
  @Field var name: String?
) : Record

/**
 * Reverse geocoding in the app's UI language. expo-location 57.0.8 builds its
 * Geocoder with Locale.getDefault() (LocationModule.kt reverseGeocode), so a
 * Korean UI on an English device got romanized English place names.
 */
class SealcardGeocoderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SealcardGeocoder")

    AsyncFunction("reverseGeocodeAsync") Coroutine { latitude: Double, longitude: Double, language: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (!Geocoder.isPresent()) {
        return@Coroutine emptyList<LocalizedPlace>()
      }
      // Blocking network lookup: keep it off the shared module queue thread.
      withContext(Dispatchers.IO) {
        @Suppress("DEPRECATION")
        val locations = Geocoder(context, Locale.forLanguageTag(language))
          .getFromLocation(latitude, longitude, 1)
        locations?.mapNotNull { address ->
          address?.let {
            LocalizedPlace(
              city = it.locality,
              district = it.subLocality,
              street = it.thoroughfare,
              region = it.adminArea,
              subregion = it.subAdminArea,
              name = it.featureName
            )
          }
        } ?: emptyList()
      }
    }
  }
}

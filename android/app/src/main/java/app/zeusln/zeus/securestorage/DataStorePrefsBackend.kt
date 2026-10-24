package app.zeusln.zeus.securestorage

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.SharedPreferencesMigration
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

// The same DataStore react-native-keychain 10 uses, including its one-time
// migration from the older RN_KEYCHAIN shared preferences file. Only one
// DataStore may own a file per process, which holds now that the library is
// no longer installed.
private val Context.rnKeychain: DataStore<Preferences> by preferencesDataStore(
    name = LegacyKeychainStore.DATASTORE_NAME,
    produceMigrations = { context ->
        listOf(SharedPreferencesMigration(context, LegacyKeychainStore.DATASTORE_NAME))
    }
)

/** RN_KEYCHAIN access. Calls block; the module runs them off the UI thread. */
class DataStorePrefsBackend(context: Context) : PrefsBackend {
    private val store = context.applicationContext.rnKeychain

    override fun get(name: String): String? = runBlocking {
        store.data.first()[stringPreferencesKey(name)]
    }

    override fun names(): Set<String> = runBlocking {
        store.data.first().asMap().keys.map { it.name }.toSet()
    }

    override fun putAll(values: Map<String, String>) {
        runBlocking {
            store.edit { prefs ->
                values.forEach { (name, value) -> prefs[stringPreferencesKey(name)] = value }
            }
        }
    }

    override fun removeAll(names: Collection<String>) {
        runBlocking {
            store.edit { prefs -> names.forEach { prefs.remove(stringPreferencesKey(it)) } }
        }
    }
}

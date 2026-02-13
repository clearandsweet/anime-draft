package com.clearandsweet.animedraft

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                DraftApp()
            }
        }
    }
}

@Composable
private fun DraftApp() {
    var baseUrl by remember { mutableStateOf("https://animedraft.godisaloli.com") }
    var hostName by remember { mutableStateOf("") }
    var lobbyId by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("Ready") }
    var inLobbyUrl by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    if (inLobbyUrl != null) {
        LobbyWebView(url = inLobbyUrl!!) {
            inLobbyUrl = null
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Anime Draft (Android alpha)", style = MaterialTheme.typography.headlineSmall)

        OutlinedTextField(
            value = baseUrl,
            onValueChange = { baseUrl = it.trim() },
            label = { Text("API Base URL") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = hostName,
            onValueChange = { hostName = it },
            label = { Text("Host name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                scope.launch {
                    status = "Creating lobby..."
                    val result = createLobby(baseUrl, hostName)
                    if (result == null) {
                        status = "Create failed"
                    } else {
                        status = "Lobby #$result created"
                        inLobbyUrl = "$baseUrl/lobby/$result"
                    }
                }
            }) {
                Text("Create Lobby")
            }
        }

        OutlinedTextField(
            value = lobbyId,
            onValueChange = { lobbyId = it.filter { c -> c.isDigit() } },
            label = { Text("Lobby ID") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                if (lobbyId.isNotBlank()) {
                    inLobbyUrl = "$baseUrl/lobby/$lobbyId"
                }
            }) {
                Text("Join Lobby")
            }
        }

        Text(status, style = MaterialTheme.typography.bodyMedium)
        Text(
            "Next step: replace WebView flow with native lobby + drafting UI backed by /api/lobby/{id} routes.",
            style = MaterialTheme.typography.bodySmall
        )
    }
}

private suspend fun createLobby(baseUrl: String, hostName: String): String? = withContext(Dispatchers.IO) {
    val endpoint = URL("${baseUrl.trimEnd('/')}/api/lobbies")
    val connection = endpoint.openConnection() as HttpURLConnection
    connection.requestMethod = "POST"
    connection.setRequestProperty("Content-Type", "application/json")
    connection.doOutput = true
    connection.connectTimeout = 15000
    connection.readTimeout = 15000

    val body = JSONObject()
    if (hostName.isNotBlank()) body.put("hostName", hostName)

    OutputStreamWriter(connection.outputStream).use { writer ->
        writer.write(body.toString())
    }

    return@withContext try {
        val stream = if (connection.responseCode in 200..299) {
            connection.inputStream
        } else {
            connection.errorStream
        }
        val payload = stream?.bufferedReader()?.use { it.readText() } ?: return@withContext null
        val json = JSONObject(payload)
        json.optString("id").ifBlank { null }
    } catch (_: Exception) {
        null
    } finally {
        connection.disconnect()
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun LobbyWebView(url: String, onClose: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(onClick = onClose) {
                Text("Back")
            }
            Text(url, style = MaterialTheme.typography.bodySmall)
        }

        AndroidView(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            factory = { context ->
                WebView(context).apply {
                    webViewClient = WebViewClient()
                    settings.javaScriptEnabled = true
                    settings.cacheMode = WebSettings.LOAD_DEFAULT
                    settings.domStorageEnabled = true
                    loadUrl(url)
                }
            },
            update = { webView -> webView.loadUrl(url) }
        )
    }
}

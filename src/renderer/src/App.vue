<template>
  <a-config-provider :theme="antTheme">
    <!-- Overlay to close the menu -->
    <div
      v-if="showMenu"
      class="overlay"
      @click="closeContextMenu"
      @click.right="closeContextMenu"
    />

    <div
      v-if="currentSelectedOption"
      class="backdrop bg-black bg-opacity-70 z-50 fixed w-full h-full"
      @click="hideMenu"
    >
      <div
        :class="{
          'w-9/12': currentSelectedOption === options.library || currentSelectedOption === options.history,
          'w-11/12': currentSelectedOption === options.wave,
          'w-2/5': currentSelectedOption !== options.wave && currentSelectedOption !== options.library && currentSelectedOption !== options.history
        }"
        class="vm-secondary-panel right-[40px] fixed flex h-full flex-col min-h-[0] bg-gray-300 p-6 text-black"
        @click="hideMenu"
      >
        <Edit
          v-if="currentSelectedOption && currentSelectedOption === options.edit"
          :id="selectedSongs.length > 0 ? selectedSongs[0] : 0"
          :tags="tags.filter(t => t.id != 9998)"
          :artists="artists"
          @updated="updated"
        />

        <Download
          v-if="currentSelectedOption && currentSelectedOption === options.download"
          :tags="tags.filter(t => t.id != 9998)"
          :artists="artists"
          :selected-artist="downloadSelectedArtist"
          @downloaded="downloaded"
          @artists-updated="artistsUpdated"
        />

        <Settings
          v-if="currentSelectedOption && currentSelectedOption === options.settings"
          @saved="settingsSaved"
        />

        <Artists v-if="currentSelectedOption && currentSelectedOption === options.artists" />

        <Tags
          v-if="currentSelectedOption && currentSelectedOption === options.tags"
          :tags="tags.filter(t => t.id != 9998)"
          @added="getTags"
        />

        <Wave
          v-if="currentSelectedOption && currentSelectedOption === options.wave"
          :id="selectedSongs.length > 0 ? selectedSongs[0] : 0"
          :preview-sink-id="previewSinkId"
          @wave-updated="waveUpdated"
        />
        <div
          v-if="currentSelectedOption && currentSelectedOption === options.library"
          class="flex flex-col space-y-4 flex-1 min-h-[0]"
        >
          <div class="library-filters flex items-start h-[200px] space-x-4">
            <div class="h-full flex-1 flex flex-col min-h-[0]">
              <div class="flex items-center space-x-2 text-xs text-white mb-2">
                <!--button
                class="px-2 py-1 bg-gray-700 flex items-center space-x-1"
                @click="selectAllArtists"
              >
                <Icon
                  class="w-4 h-4"
                  icon="ri:checkbox-line"
                />
                <span>Todos</span>
              </button-->

                <a-button
                  size="small"
                  @click="selectAllArtists"
                >
                  Todos
                </a-button>

                <!--button
                class="px-2 py-1 bg-gray-700 flex items-center space-x-1"
                @click="selectNoneArtists"
              >
                <Icon
                  class="w-4 h-4"
                  icon="carbon:checkbox"
                />
                <span>Ninguno</span>
              </button-->

                <a-button
                  size="small"
                  @click="selectNoneArtists"
                >
                  Ninguno
                </a-button>
              </div>

              <div class="overflow-y-scroll bg-gray-300 flex-1">
                <multiselect
                  ref="artistMultiSelect"
                  name="artists"
                  :list="artists"
                  :selected-default="selectedArtists"
                  @changed="artistsChanged"
                />
              </div>
            </div>

            <div class="h-full flex-1 flex flex-col min-h-[0]">
              <div class="flex items-center space-x-2 text-xs text-white mb-2">
                <a-button
                  size="small"
                  @click="selectAllTags($event)"
                >
                  Todos
                </a-button>

                <a-button
                  size="small"
                  @click="selectNoneTags"
                >
                  Ninguno
                </a-button>
              </div>

              <div class="overflow-y-scroll bg-gray-300 flex-1">
                <multiselect
                  ref="tagMultiSelect"
                  name="tags"
                  :list="tags"
                  :selected-default="selectedTags"
                  @changed="tagsChanged"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between space-x-3">
            <div class="flex items-center space-x-3">
              <!--button
              v-if="playlistDetails.length === 0"
              :disabled="selectedSongs.length <= 0 || player1.status === playerStatuses.Cambiando || player2.status
                === playerStatuses.Cambiando"
              type="button"
              class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
              @click="addToPlaylist(0)"
            >
              <Icon
                class="w-5 h-5"
                icon="material-symbols:add"
              />
              <span>Agregar</span>
            </button-->

              <a-button
                v-if="playlistDetails.length === 0"
                :disabled="addButtonDisabled"
                type="primary"
                class="flex items-center space-x-1 pl-2.5"
                @click="addToPlaylist(0, false, { ignoreMarks: $event.altKey })"
              >
                <i-mdi-plus
                  class="w-5 h-5"
                />
                Agregar
              </a-button>

              <!--button
              v-if="playlistDetails.length === 0"
              :disabled="addRandomButtonDisabled"
              type="button"
              class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
              @click="addToPlaylist(3)"
            >
              <Icon
                class="w-4 h-4"
                icon="oi:random"
              />
              <span>Aleatorio</span>
            </button-->

              <a-button
                v-if="playlistDetails.length === 0"
                :disabled="addRandomButtonDisabled"
                type="primary"
                class="flex items-center space-x-1 pl-2.5"
                @click="addToPlaylist(3)"
              >
                <i-mdi-shuffle
                  class="w-4 h-4"
                />
                Aleatorio
              </a-button>


              <template v-if="playlistDetails.length > 0">
                <!--button
                :disabled="selectedSongs.length <= 0"
                type="button"
                class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
                @click="addToPlaylist(1)"
              >
                <Icon
                  class="w-5 h-5"
                  icon="ic:baseline-move-up"
                />
                <span>Al comienzo</span>
              </button-->

                <a-button
                  :disabled="selectedSongs.length <= 0"
                  type="primary"
                  class="flex items-center space-x-1 pl-2.5"
                  @click="addToPlaylist(1, false, { ignoreMarks: $event.altKey })"
                >
                  <i-ic-baseline-move-up
                    class="w-5 h-5"
                  />
                  Al comienzo
                </a-button>

                <!--button
                :disabled="selectedSongs.length <= 0"
                type="button"
                class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
                @click="addToPlaylist(2)"
              >
                <Icon
                  class="w-5 h-5"
                  icon="ic:baseline-move-down"
                />
                <span>Al final</span>
              </button-->

                <a-button
                  :disabled="selectedSongs.length <= 0"
                  type="primary"
                  class="flex items-center space-x-1 pl-2.5"
                  @click="addToPlaylist(2, false, { ignoreMarks: $event.altKey })"
                >
                  <i-ic-baseline-move-down
                    class="w-5 h-5"
                  />
                  Al final
                </a-button>
              </template>

              <!--button
              :disabled="selectedSongs.length !== 1"
              type="button"
              class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
              @click="currentSelectedOption = options.edit"
            >
              <Icon
                class="w-5 h-5"
                icon="material-symbols:info-outline"
              />
              <span>Info</span>
            </button-->

              <a-button
                :disabled="selectedSongs.length !== 1"
                class="flex items-center space-x-1 pl-2.5"
                @click="currentSelectedOption = options.edit"
              >
                <i-material-symbols-info-outline
                  class="w-5 h-5"
                />
                Info
              </a-button>

              <!--button
              :disabled="selectedSongs.length !== 1"
              type="button"
              class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
              @click="currentSelectedOption = options.wave"
            >
              <Icon
                class="w-5 h-5"
                icon="mdi:sine-wave"
              />
              <span>Onda</span>
            </button-->

              <a-button
                :disabled="selectedSongs.length !== 1"
                class="flex items-center space-x-1 pl-2.5"
                @click="currentSelectedOption = options.wave"
              >
                <i-mdi-sine-wave
                  class="w-5 h-5"
                />
                Onda
              </a-button>

              <!--button
              :disabled="selectedSongs.length !== 1"
              type="button"
              class="text-sm whitespace-nowrap px-2 py-2 bg-red-600 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
              @click="deleteSong"
            >
              <Icon
                class="w-5 h-5"
                icon="iwwa:delete"
              />
              <span>Eliminar</span>
            </button-->

              <a-button
                danger
                :disabled="selectedSongs.length !== 1"
                class="flex items-center space-x-1 pl-2.5"
                @click="deleteSong"
              >
                <i-iwwa-delete
                  class="w-4 h-4"
                />
                Eliminar
              </a-button>
              <a-button
                v-if="false"
                :disabled="isExportingM3U || filteredSongs2.length === 0"
                class="flex items-center space-x-1 pl-2.5"
                @click="exportM3U"
              >
                <i-mdi-file-export-outline
                  class="w-4 h-4"
                />
                {{ isExportingM3U ? 'Exportando...' : 'Exportar' }}
              </a-button>
            </div>

            <div class="flex items-center space-x-3">
              <a-input
                v-model:value="filterQuery"
                :disabled="isLoadingLibrary"
                placeholder="Filtrar por título o artista"
                style="width: 300px"
                class="vm-filter-input"
                allow-clear
                @blur="onSearchBlur"
              />
              <a-dropdown>
                <a-button class="flex items-center space-x-1 pl-2.5">
                  <span>{{ m3uSourceLabel }}</span>
                  <i-mdi-menu-down class="w-4 h-4" />
                </a-button>
                <template #overlay>
                  <a-menu
                    :selected-keys="[m3uExportSourceFilter]"
                    @click="onM3uSourceSelect"
                  >
                    <a-menu-item key="any">
                      Cualquier fuente
                    </a-menu-item>
                    <a-menu-item key="apple">
                      Apple Music
                    </a-menu-item>
                    <a-menu-item key="youtube">
                      Youtube
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto">
            <a-table
              class="ant-table-striped"
              :animate-rows="false"
              :row-key="record => record.id"
              :row-class-name="(_record, index) => (deletedSongs.includes(_record.id) ? 'table-deleted' : index % 2 === 1 ? 'table-striped' : null)"
              :show-sorter-tooltip="false"
              :loading="isLoadingLibrary"
              :pagination="{ current: libraryState.page, hideOnSinglePage: false, total: filteredSongs2.length, 'show-total': (total) => `${selectedSongs.length} seleccionadas / ${total} canciones`, defaultPageSize: 24, pageSize: pageSizeRef, showSizeChanger: false }"
              :row-selection="{ selectedRowKeys: selectedSongs, onChange: onSelectChange, onSelectAll: onSelectAll }"
              sticky
              size="small"
              :data-source="filteredSongs2"
              :columns="columns"
              @change="onTableChange"
            >
              <template #emptyText>
                <div class="min-h-[40px] leading-[40px]">
                  No hay canciones que mostrar.
                </div>
              </template>
              <template #bodyCell="{text, record, column}">
                <template v-if="column.dataIndex === 'preview'">
                  <a-button
                    class="flex items-center justify-center w-8 h-8 p-0"
                    size="small"
                    :type="previewSongId === record.id && previewStatus === 'playing' ? 'primary' : 'default'"
                    :loading="isPreviewLoading && previewSongId === record.id"
                    @mousedown.stop.prevent="startPreview(record)"
                    @mouseup.stop="stopPreview()"
                    @mouseleave.stop="stopPreview()"
                    @touchstart.stop.prevent="startPreview(record)"
                    @touchend.stop="stopPreview()"
                  >
                    <i-mdi-headphones
                      class="w-4 h-4"
                    />
                  </a-button>
                </template>
                <template v-else-if="column.dataIndex === 'name'">
                  <div class="flex items-center space-x-2">
                    <span>{{ text }}</span>
                    <span
                      v-if="record.Tags.some(tag => tag.id === 9998)"
                      class="px-[10px] py-[1px] rounded-full bg-yellow-200 text-yellow-00 text-xs"
                    >Reciente</span>
                  </div>
                </template>
                <template v-else-if="column.dataIndex === 'artistsJoined'">
                  <div class="flex flex-wrap gap-x-3 gap-y-1">
                    <div
                      v-for="artist in record.Artists"
                      :key="artist.id"
                      class="flex items-center space-x-1 text-[13px]"
                    >
                      <button
                        type="button"
                        class="text-left hover:underline cursor-pointer"
                        title="Ver canciones de este artista"
                        @click.stop="quickFilterByArtist(artist.id)"
                      >
                        {{ artist.name }}
                      </button>
                    </div>
                  </div>
                </template>
                <template v-else-if="column.dataIndex === 'source'">
                  <i-ic-baseline-apple
                    v-if="record.isAppleMusic"
                    class="mx-auto w-5 h-5"
                  />
                  <i-mingcute-youtube-fill
                    v-else
                    class="mx-auto w-5 h-5"
                  />
                </template>
                <template v-else-if="column.dataIndex === 'decks'">
                  <div class="flex items-center justify-center space-x-2">
                    <button
                      :disabled="isDeckManualLoadDisabled('A')"
                      type="button"
                      class="flex items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer text-white"
                      @click.stop="loadLibrarySongToDeck(record, 'A')"
                    >
                      <i-ic-baseline-download
                        class="w-6 h-6 deck-a-indicator"
                      />
                      <span class="inline-block p-1 leading-none deck-a-badge">A</span>
                    </button>

                    <button
                      :disabled="isDeckManualLoadDisabled('B')"
                      type="button"
                      class="flex items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer text-white"
                      @click.stop="loadLibrarySongToDeck(record, 'B')"
                    >
                      <i-ic-baseline-download
                        class="w-6 h-6 deck-b-indicator"
                      />
                      <span class="inline-block p-1 leading-none deck-b-badge">B</span>
                    </button>
                  </div>
                </template>
              </template>
            </a-table>
          </div>
        </div>

        <div
          v-if="currentSelectedOption && currentSelectedOption === options.history"
          class="flex flex-col space-y-4 flex-1 min-h-[0]"
        >
          <div class="flex items-center justify-between space-x-3">
            <div class="flex items-center space-x-3">
              <a-button
                v-if="playlistDetails.length === 0"
                :disabled="historySelectedRows.length <= 0"
                type="primary"
                class="flex items-center space-x-1 pl-2.5"
                @click="addHistoryToPlaylist(0, { ignoreMarks: $event.altKey })"
              >
                <i-mdi-plus class="w-5 h-5" />
                Agregar
              </a-button>

              <a-button
                v-if="playlistDetails.length === 0"
                :disabled="historySelectedRows.length <= 1"
                type="primary"
                class="flex items-center space-x-1 pl-2.5"
                @click="addHistoryToPlaylist(3)"
              >
                <i-mdi-shuffle class="w-4 h-4" />
                Aleatorio
              </a-button>

              <template v-if="playlistDetails.length > 0">
                <a-button
                  :disabled="historySelectedRows.length <= 0"
                  type="primary"
                  class="flex items-center space-x-1 pl-2.5"
                  @click="addHistoryToPlaylist(1, { ignoreMarks: $event.altKey })"
                >
                  <i-ic-baseline-move-up class="w-5 h-5" />
                  Al comienzo
                </a-button>

                <a-button
                  :disabled="historySelectedRows.length <= 0"
                  type="primary"
                  class="flex items-center space-x-1 pl-2.5"
                  @click="addHistoryToPlaylist(2, { ignoreMarks: $event.altKey })"
                >
                  <i-ic-baseline-move-down class="w-5 h-5" />
                  Al final
                </a-button>
              </template>
            </div>

            <div class="text-sm text-gray-700">
              {{ recentSongHistory.length }} canciones recientes
            </div>
          </div>

          <div class="flex-1 overflow-y-auto">
            <a-table
              class="ant-table-striped"
              :animate-rows="false"
              :row-key="record => record.historyId"
              :row-class-name="(_record, index) => (index % 2 === 1 ? 'table-striped' : null)"
              :show-sorter-tooltip="false"
              :pagination="false"
              sticky
              size="small"
              :data-source="recentSongHistory"
              :columns="historyColumns"
              :row-selection="{ selectedRowKeys: historySelectedRows, onChange: onHistorySelectChange }"
            >
              <template #emptyText>
                <div class="min-h-[40px] leading-[40px]">
                  No hay canciones en historial.
                </div>
              </template>
              <template #bodyCell="{ record, column }">
                <template v-if="column.dataIndex === 'artistsJoined'">
                  <div class="flex flex-wrap gap-x-3 gap-y-1">
                    <div
                      v-for="artist in record.Artists"
                      :key="artist.id"
                      class="flex items-center space-x-1 text-[13px]"
                    >
                      <button
                        type="button"
                        class="text-left hover:underline cursor-pointer"
                        title="Ver canciones de este artista"
                        @click.stop="quickFilterByArtist(artist.id)"
                      >
                        {{ artist.name }}
                      </button>
                    </div>
                  </div>
                </template>
                <template v-else-if="column.dataIndex === 'source'">
                  <i-ic-baseline-apple
                    v-if="record.isAppleMusic"
                    class="mx-auto w-5 h-5"
                  />
                  <i-mingcute-youtube-fill
                    v-else
                    class="mx-auto w-5 h-5"
                  />
                </template>
                <template v-else-if="column.dataIndex === 'decks'">
                  <div class="flex items-center justify-center space-x-2">
                    <button
                      :disabled="isDeckManualLoadDisabled('A')"
                      type="button"
                      class="flex items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer text-white"
                      @click.stop="loadLibrarySongToDeck(record, 'A')"
                    >
                      <i-ic-baseline-download class="w-6 h-6 deck-a-indicator" />
                      <span class="inline-block p-1 leading-none deck-a-badge">A</span>
                    </button>

                    <button
                      :disabled="isDeckManualLoadDisabled('B')"
                      type="button"
                      class="flex items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer text-white"
                      @click.stop="loadLibrarySongToDeck(record, 'B')"
                    >
                      <i-ic-baseline-download class="w-6 h-6 deck-b-indicator" />
                      <span class="inline-block p-1 leading-none deck-b-badge">B</span>
                    </button>
                  </div>
                </template>
              </template>
            </a-table>
          </div>
        </div>
      </div>
    </div>

    <div class="vmusic-app flex items-stretch min-w-0">
      <div class="flex-[5] flex flex-col justify-between min-w-0">
        <Player
          ref="player1"
          :class="{
            'opacity-40': !player1 || player1.status !== playerStatuses.Reproduciendo
          }"
          :statuses="playerStatuses"
          position="top"
          :output-sink-id="deckSinkId"
          class="transition-opacity duration-300"
          @artist-click="openLibraryForArtist"
          @song-click="openLibraryForSong"
          @preview-start="previewStartFromPlayer"
          @preview-stop="stopPreview"
          @loaded="checkPlayers(player1)"
          @stopped="checkPlayers(player1)"
          @finished="onSongFinished"
          @fading="songFading(player1)"
          @speed="saveSpeed(player1)"
        />
        <div class="p-6">
          <div class="relative">
            <div
              id="logo"
              class="vm-logo w-full h-auto select-none"
              role="img"
              aria-label="Salsamanía por Rogers Vizcaino"
              v-html="logoSvgMarkup"
            />
          </div>
        </div>
        <Player
          ref="player2"
          :class="{
            'opacity-40': !player2 || player2.status !== playerStatuses.Reproduciendo
          }"
          :statuses="playerStatuses"
          position="bottom"
          :output-sink-id="deckSinkId"
          class="transition-opacity duration-300"
          @artist-click="openLibraryForArtist"
          @song-click="openLibraryForSong"
          @preview-start="previewStartFromPlayer"
          @preview-stop="stopPreview"
          @loaded="checkPlayers(player2)"
          @stopped="checkPlayers(player2)"
          @finished="onSongFinished"
          @fading="songFading(player2)"
          @speed="saveSpeed(player2)"
        />
      </div>

      <div class="flex-[6] flex flex-col p-4 space-y-2 min-w-0">
        <div class="flex items-center space-x-10 justify-between">
          <div class="control-buttons flex items-center space-x-3">
            <button
              v-if="
                (player1 &&
                  (player1.status === playerStatuses.Reproduciendo ||
                    player1.status === playerStatuses.Cambiando ||
                    player1.status === playerStatuses.Nivelando)) ||
                  (player2 &&
                    (player2.status === playerStatuses.Reproduciendo ||
                      player2.status === playerStatuses.Cambiando ||
                      player2.status === playerStatuses.Nivelando))
              "
              :disabled="
                (player1 && player1.status === playerStatuses.Cambiando) ||
                  (player2 && player2.status === playerStatuses.Cambiando)
              "
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
              @click="pause"
            >
              <i-material-symbols-pause
                class="w-10 h-10 text-white"
              />
            </button>

            <button
              v-else
              :disabled="
                (!player1 || player1.status === playerStatuses.Cambiando || player1.status ===
                  playerStatuses['Sin Carga'])
                  && (!player2 || player2.status === playerStatuses['Sin Carga'] ||
                    player2.status === playerStatuses.Cambiando)
              "
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
              @click="play"
            >
              <i-mdi-play
                class="w-10 h-10 text-white"
              />
            </button>

            <button
              :disabled="
                (!player1 || player1.status === playerStatuses.Cambiando || player1.status ===
                  playerStatuses['Sin Carga'])
                  && (!player2 || player2.status === playerStatuses['Sin Carga'] ||
                    player2.status === playerStatuses.Cambiando)
              "
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
              @click="next"
            >
              <i-material-symbols-skip-next
                class="w-6 h-6 text-white"
              />
            </button>

            <div class="flex items-center">
              <a-checkbox
                v-if="player1 && player2 && (player1.status === playerStatuses.Reproduciendo || player2.status === playerStatuses.Reproduciendo)"
                v-model:checked="autopause"
                class="text-white"
              >
                Autopausa
              </a-checkbox>
            </div>
          </div>

          <div class="flex items-center space-x-3">
            <button
              :disabled="selectedRows.length <= 0"
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
              @click="moveFirst(playlistDetails, selectedRows[0])"
            >
              <i-ic-baseline-move-up
                class="w-6 h-6 text-white"
              />
            </button>

            <button
              :disabled="selectedRows.length <= 0"
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
              @click="moveUp(playlistDetails, selectedRows[0])"
            >
              <i-teenyicons-up-solid
                class="w-6 h-6 text-white"
              />
            </button>

            <button
              :disabled="selectedRows.length <= 0"
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
              @click="moveDown(playlistDetails, selectedRows[0])"
            >
              <i-teenyicons-down-solid
                class="w-6 h-6 text-white"
              />
            </button>

            <button
              :disabled="selectedRows.length <= 0"
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 text-white p-2"
              @click="remove(playlistDetails, selectedRows[0])"
            >
              <i-mdi-remove-bold
                class="w-6 h-6 text-white"
              />
            </button>
          </div>

          <div class="flex items-center space-x-3">
            <button
              :disabled="!player1 || selectedRows.length <= 0 || player1.status === playerStatuses.Reproduciendo ||
                player1.status === playerStatuses.Cambiando"
              type="button"
              class="flex items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-gray-600 text-white p-2"
              @click="loadDeck('A')"
            >
              <i-ic-baseline-download class="w-6 h-6 deck-a-indicator" />
              <span class="inline-block p-1 leading-none deck-a-badge">A</span>
            </button>

            <button
              :disabled="!player2 || selectedRows.length <= 0 || player2.status === playerStatuses.Reproduciendo ||
                player2.status === playerStatuses.Cambiando"
              type="button"
              class="flex items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-gray-600 text-white p-2"
              @click="loadDeck('B')"
            >
              <i-ic-baseline-download class="w-6 h-6 deck-b-indicator" />
              <span class="inline-block p-1 leading-none deck-b-badge">B</span>
            </button>
          </div>
        </div>

        <div class="bg-gray-900 flex-1 overflow-y-auto basis-0">
          <table class="dark border-collapse w-full text-sm">
            <tr
              v-for="(s, index) in playlistDetails"
              :key="s.entryId"
              :data-entry-id="s.entryId"
              @click="selectRow($event, s.entryId)"
              @mousedown.left="onPlaylistRowPressStart(s, $event)"
              @mouseup.left="onPlaylistRowPressEnd()"
              @mouseleave="onPlaylistRowPressEnd()"
              @touchstart.stop.prevent="onPlaylistRowPressStart(s)"
              @touchend.stop="onPlaylistRowPressEnd()"
              @touchcancel.stop="onPlaylistRowPressEnd()"
            >
              <td
                class="cursor-pointer"
                :class="{ 'playlist-row-selected': selectedRows.includes(s.entryId) }"
              >
                {{ s.name }}
              </td>
              <td
                class="cursor-pointer"
                :class="{ 'playlist-row-selected': selectedRows.includes(s.entryId) }"
              >
                {{ s.Artists.map((i) => i.name).join(', ') }}
              </td>
              <td
                class="text-center w-[32px]"
                :class="{ 'playlist-row-selected': selectedRows.includes(s.entryId) }"
              >
                <i-mdi-headphones
                  v-if="isPlaylistEntryPreviewing(s)"
                  class="w-4 h-4 text-gray-400 mx-auto"
                  title="Previsualizando en audífonos"
                />
                <i-mdi-alert
                  v-else-if="hasRecentArtistMatch(s, index)"
                  class="w-4 h-4 text-yellow-500 mx-auto"
                  title="Artista se reprodujo recientemente"
                />
              </td>
            </tr>
          </table>
        </div>

        <div class="flex items-center justify-between">
          <div class="play-next-status text-xs text-white">
            <span v-if="playlistDetails.length <= 0">No hay más canciones</span>
            <span v-else-if="playlistDetails.length > 1">{{ playlistDetails.length }} canciones</span>
            <span v-else>1 canción restante</span>
            <span
              v-if="playlistEtaText"
              class="text-lime-500"
            >. {{ playlistEtaText }}</span>
            <span v-else>.</span>
          </div>

          <div class="flex items-center space-x-2">
            <div
              v-if="playlistDetails.length > 3"
              class="flex items-center space-x-2 mr-4"
            >
              <input
                v-model="playlistSearchQuery"
                type="text"
                class="bg-gray-600 text-white text-xs px-2 py-1 w-40 outline-none"
                placeholder="Buscar en lista"
                @input="onPlaylistSearchInput"
              >
              <span class="text-white text-xs whitespace-nowrap">
                {{ playlistSearchResults.length > 0 ? playlistSearchIndex + 1 : 0 }}/{{ playlistSearchResults.length }}
              </span>
              <div class="flex items-center space-x-1">
                <button
                  :disabled="playlistSearchResults.length <= 1"
                  class="text-white bg-gray-500 disabled:opacity-40 text-xs px-1"
                  @click="prevPlaylistResult"
                >
                  ←
                </button>
                <button
                  :disabled="playlistSearchResults.length <= 1"
                  class="text-white bg-gray-500 disabled:opacity-40 text-xs px-1"
                  @click="nextPlaylistResult"
                >
                  →
                </button>
              </div>
            </div>

            <input
              v-if="false"
              ref="m3uInput"
              type="file"
              accept=".m3u"
              class="hidden"
              @change="onM3UFileChange"
            >
            <button
              v-if="false"
              :disabled="isImportingM3U"
              type="button"
              class="flex text-white text-xs items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-gray-600 p-1 px-2"
              @click="openM3UPicker"
            >
              <i-mdi-file-music-outline
                class="w-4 h-4"
              />
              <span>{{ isImportingM3U ? 'Cargando...' : 'Cargar' }}</span>
            </button>
            <button
              :disabled="playlistDetails.length <= 1"
              type="button"
              class="flex text-white text-xs items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-gray-600 p-1 px-2"
              @click="shufflePlaylist"
            >
              <i-ic-baseline-shuffle
                class="w-4 h-4"
              />
              <span>Revolver</span>
            </button>

            <button
              :disabled="playlistDetails.length <= 0"
              type="button"
              class="flex text-white text-xs items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-gray-600 p-1 px-2"
              @click="removeAll(playlistDetails)"
            >
              <i-iconamoon-trash-fill
                class="w-4 h-4"
              />
              <span>Vaciar</span>
            </button>
          </div>
        </div>
      </div>

      <div
        class="vm-side-nav z-50 text-sm flex flex-col space-y-10 justify-between items-center bg-gray-100 fullheight"
      >
        <div class="flex flex-col w-full">
          <div
            :class="{
              'vm-item-selected':
                currentSelectedOption === options.library || currentSelectedOption === options.wave
            }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.library)"
          >
            <div>
              <i-material-symbols-library-music-outline-sharp
                class="w-7 h-7"
              />
            </div>
          </div>

          <div
            :class="{ 'vm-item-selected': currentSelectedOption === options.download }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.download)"
          >
            <div class="relative">
              <i-ic-sharp-download
                class="w-8 h-8"
              />
              <span
                v-if="downloadTasksCount > 0"
                class="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[16px] text-center"
              >
                {{ downloadTasksCount }}
              </span>
            </div>
          </div>

          <div
            :class="{ 'vm-item-selected': currentSelectedOption === options.history }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.history)"
          >
            <div>
              <i-mdi-clock-outline class="w-7 h-7" />
            </div>
          </div>
        </div>

        <div class="flex flex-col w-full">
          <div
            :class="{ 'vm-item-selected': currentSelectedOption === options.artists }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.artists)"
          >
            <div>
              <i-material-symbols-artist
                class="w-8 h-8"
              />
            </div>
          </div>

          <div
            :class="{ 'vm-item-selected': currentSelectedOption === options.tags }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.tags)"
          >
            <div>
              <i-mdi-tags
                class="w-8 h-8"
              />
            </div>
          </div>

          <div
            :class="{ 'vm-item-selected': currentSelectedOption === options.settings }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.settings)"
          >
            <div>
              <i-mdi-settings
                class="w-8 h-8"
              />
            </div>
          </div>

        <!--div
          :class="{ 'bg-gray-300': currentSelectedOption === options.settings }"
          class="group hover:cursor-pointer flex flex-col items-center justify-center px-3 pt-3 pb-3"
          @click="setOption(options.settings)"
        >
          <div>
            <Icon class="w-8 h-8" icon="ic:sharp-settings" />
          </div>
          <div class="text-center font-bold">Ajustes</div>
        </div-->
        </div>
      </div>
    </div>
  </a-config-provider>
</template>

<script setup>
import axios from 'axios'
import { onMounted, onUnmounted, computed, ref, watch, reactive, nextTick } from 'vue'
import dayjs from 'dayjs'
import logoSvgMarkup from './assets/logo.svg?raw'

/* Components */
import Artists from './components/Artists.vue'
import Tags from './components/Tags.vue'
import Player from './components/Player.vue'
import Download from './components/Download.vue'
import Settings from './components/Settings.vue'
import Edit from './components/Edit.vue'
import Wave from './components/Wave.vue'
import Multiselect from './components/Multiselect.vue'

let options = {
  library: 10,
  download: 20,
  history: 22,
  downloadDetails: 25,
  tags: 30,
  settings: 40,
  artists: 50,
  edit: 60,
  wave: 70
}

const playerStatuses = {
  'Sin Carga': 10,
  Cargando: 20,
  Listo: 30,
  Reproduciendo: 40,
  Pausado: 50,
  Cambiando: 60,
  Detenido: 70,
  Nivelando: 90
}
const HEADPHONE_REGEX = /(head(phone|set)|aud[ií]fono|auricular|earbud)/i
const COLOR_SCHEMA_DEFAULT = 'default'
const COLOR_SCHEMA_VALUES = ['default', 'monochrome', 'sunset', 'aurora', 'bosque', 'linen', 'coral', 'nocturno', 'ocean']
const COLOR_SCHEMA_TRANSITION_MS = 1000
let colorSchemaTransitionTimer = null
let colorSchemaTransitionRaf = null
const SONG_HISTORY_STORAGE_KEY = 'vmusic_song_history'
const antTheme = {
  token: {
    colorPrimary: '#57534e',
    colorInfo: '#57534e',
    colorLink: '#57534e',
    colorPrimaryHover: '#44403c',
    colorPrimaryActive: '#292524',
    colorPrimaryBorder: '#57534e',
    controlOutline: 'rgba(120, 113, 108, 0.28)',
    controlItemBgActive: '#d6d3d1'
  },
  components: {
    Select: {
      optionActiveBg: '#d6d3d1',
      optionSelectedBg: '#d6d3d1',
      optionSelectedColor: '#0f172a'
    },
    Table: {
      rowHoverBg: '#d6d3d1',
      rowSelectedBg: '#d6d3d1',
      rowSelectedHoverBg: '#d6d3d1'
    }
  }
}

function normalizeHistoryLimit(limit) {
  const parsed = Number(limit)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 15
  }

  return Math.floor(parsed)
}

function normalizeRowsPerPage(value, fallback = 24) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.floor(parsed)
}

function normalizeColorSchema(schema) {
  if (schema === 'graphite') {
    return 'aurora'
  }
  if (!schema || !COLOR_SCHEMA_VALUES.includes(schema)) {
    return COLOR_SCHEMA_DEFAULT
  }

  return schema
}

function applyColorSchema(schema) {
  const normalized = normalizeColorSchema(schema)
  const root = document.documentElement
  root.classList.add('vm-theme-transitioning')

  // Ensure the transition styles are committed before changing CSS variables.

  root.offsetHeight
  if (colorSchemaTransitionRaf) {
    cancelAnimationFrame(colorSchemaTransitionRaf)
  }
  colorSchemaTransitionRaf = requestAnimationFrame(() => {
    root.setAttribute('data-color-schema', normalized)
    window.dispatchEvent(new CustomEvent('vmusic-color-schema-changed', {
      detail: { schema: normalized }
    }))
    colorSchemaTransitionRaf = null
  })
  if (colorSchemaTransitionTimer) {
    clearTimeout(colorSchemaTransitionTimer)
  }
  colorSchemaTransitionTimer = setTimeout(() => {
    root.classList.remove('vm-theme-transitioning')
    colorSchemaTransitionTimer = null
  }, COLOR_SCHEMA_TRANSITION_MS + 40)

  return normalized
}

let currentSelectedOption = ref(null)

// Library
const artists = ref([])
const filteredArtists = ref([])
const songs = ref([])
const filteredSongs = ref([])
const selectedTags = ref([])
const selectedArtists = ref([])
const selectedSongs = ref([])
const filterQuery = ref('')
const deletedSongs = ref([])
const isLoadingLibrary = ref(true)
const autopause = ref(false)
const previewAudio = ref(null)
const previewSongId = ref(null)
const previewStatus = ref('idle')
const isPreviewLoading = ref(false)
const previewSinkId = ref(null)
const previewOutputs = ref([])
const previewPlaylistEntryId = ref(null)
const deckSinkId = ref(null)
const hasStoredSettings = Boolean(localStorage.getItem('vmusic_settings'))
const savedSettingsRef = JSON.parse(localStorage.getItem('vmusic_settings')) || {}
const normalizedHistoryLimit = normalizeHistoryLimit(savedSettingsRef.historyLimit)
const normalizedRowsPerPage = normalizeRowsPerPage(savedSettingsRef.rowsPerPage, 24)
const normalizedRowsPerPageFs = normalizeRowsPerPage(savedSettingsRef.rowsPerPageFs, normalizedRowsPerPage)
previewSinkId.value = savedSettingsRef.previewSinkId || null
deckSinkId.value = savedSettingsRef.deckSinkId || null
const excludedTags = ref(savedSettingsRef.excludeTags || [])
const colorSchema = ref(applyColorSchema(savedSettingsRef.colorSchema))
if (
  hasStoredSettings && (
    savedSettingsRef.colorSchema !== colorSchema.value || savedSettingsRef.historyLimit !== normalizedHistoryLimit || savedSettingsRef.rowsPerPage !== normalizedRowsPerPage || savedSettingsRef.rowsPerPageFs !== normalizedRowsPerPageFs
  )
) {
  localStorage.setItem('vmusic_settings', JSON.stringify({
    ...savedSettingsRef,
    colorSchema: colorSchema.value,
    historyLimit: normalizedHistoryLimit,
    rowsPerPage: normalizedRowsPerPage,
    rowsPerPageFs: normalizedRowsPerPageFs
  }))
}
const downloadTasksCount = ref(0)
const DOWNLOAD_TASKS_STORAGE_KEY = 'vmusic_download_tasks'
const DOWNLOAD_TASK_TIMEOUT_MS = 5 * 60 * 1000

// Tags
const tags = ref([])

// Playlist
const history = ref([])
const tagHistory = ref([])
const songHistory = ref([])
const historySelectedRows = ref([])
const playlist = ref([])
const playlistDetails = ref([])
const currentMode = ref(0)
const selectedRows = ref([])
const m3uInput = ref(null)
const isImportingM3U = ref(false)
const isExportingM3U = ref(false)
const importSongsCacheLoaded = ref(false)
const importSongsCache = ref([])
const playlistSearchQuery = ref('')
const playlistSearchResults = ref([])
const playlistSearchIndex = ref(0)
const PLAYLIST_PREVIEW_HOLD_MS = 500
let playlistPreviewPressTimer = null
let isPlaylistPressPreviewActive = false
const m3uExportSourceFilter = ref('any')
const m3uSourceLabel = computed(() => {
  switch (m3uExportSourceFilter.value) {
  case 'apple':
    return 'Apple Music'
  case 'youtube':
    return 'Youtube'
  default:
    return 'Cualquier fuente'
  }
})

// Players
const player1 = ref(null)
const player2 = ref(null)
const isFirstPlay = ref(true)
let playersResizeRafId = null
const isWindowFullscreen = ref(false)
const mediaSessionActions = ['play', 'pause', 'nexttrack', 'previoustrack', 'stop']
const mediaKeyCodes = new Set(['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaTrackNext', 'MediaTrackPrevious', 'MediaStop'])

// Multiselects
const artistMultiSelect = ref(null)
const tagMultiSelect = ref(null)
const pageSizeRef = ref(24)
const libraryState = ref({
  artists: [],
  tags: [],
  page: 1
})

const downloadSelectedArtist = ref(null)
const generateEntryId = () => `${Date.now()}-${Math.random().toString(16)
  .slice(2)}`
const createPlaylistEntry = (song, options = {}) => {
  const entry = {
    ...song,
    entryId: generateEntryId(),
    played: false
  }

  if (options.ignoreMarks) {
    entry.start = null
  }

  return entry
}

const filteredSongs2 = computed(() => {
  const normalizedQuery = removeAccents((filterQuery.value || '').toLowerCase())

  let filtered = songs.value

  if (m3uExportSourceFilter.value === 'apple') {
    filtered = filtered.filter((item) => Boolean(item.isAppleMusic))
  } else if (m3uExportSourceFilter.value === 'youtube') {
    filtered = filtered.filter((item) => !Boolean(item.isAppleMusic))
  }

  if (!normalizedQuery) {
    return filtered
  }

  return filtered.filter((item) => {
    const normalizedName = removeAccents(item.name.toLowerCase())
    const normalizedArtists = removeAccents(item.Artists.map((a) => a.name)
      .join('')
      .toLowerCase())

    return (
      normalizedName.includes(normalizedQuery) || normalizedArtists.includes(normalizedQuery)
    )
  })
})

const columns = computed(() => {
  let cols = [
    {
      title: '',
      dataIndex: 'preview',
      width: 90,
      align: 'center'
    },
    {
      title: 'Título',
      dataIndex: 'name',
      sorter: {
        compare: (a, b) => a.name.localeCompare(b.name)
      }
    },
    {
      title: 'Artista',
      dataIndex: 'artistsJoined',
      sorter: {
        compare: (a, b) => a.artistsJoined.localeCompare(b.artistsJoined)
      }
    },
    {
      title: 'Duración',
      dataIndex: 'duration_original',
      width: 100,
      align: 'right',
      sorter: {
        compare: (a, b) => (a.duration || 0) - (b.duration || 0)
      }
    },
    {
      title: 'Fuente',
      dataIndex: 'source',
      align: 'center',
      width: 80
    },
    {
      title: '',
      dataIndex: 'decks',
      align: 'center',
      width: 190
    }
  ]

  // Update column order
  const sortConfig = libraryState.value && libraryState.value.sort
  if (sortConfig && sortConfig.column) {
    cols.forEach((col) => {
      delete col.sortOrder
    })

    const foundCol = cols.find((item) => item.dataIndex && item.dataIndex.trim() === sortConfig.column.trim())
    if (foundCol) {
      foundCol.sortOrder = sortConfig.order
    }
  }

  return cols
})

const historyColumns = computed(() => ([
  {
    title: 'Título',
    dataIndex: 'name',
    sorter: {
      compare: (a, b) => a.name.localeCompare(b.name)
    }
  },
  {
    title: 'Artista',
    dataIndex: 'artistsJoined',
    sorter: {
      compare: (a, b) => a.artistsJoined.localeCompare(b.artistsJoined)
    }
  },
  {
    title: 'Fuente',
    dataIndex: 'source',
    align: 'center',
    width: 80
  },
  {
    title: '',
    dataIndex: 'decks',
    align: 'center',
    width: 190
  }
]))

const recentSongHistory = computed(() => {
  const limit = normalizeHistoryLimit(JSON.parse(localStorage.getItem('vmusic_settings'))?.historyLimit)

  return [...songHistory.value]
    .sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0))
    .slice(0, limit)
})

const addButtonDisabled = computed(() => {
  const player1Status = player1.value?.status
  const player2Status = player2.value?.status

  return (
    selectedSongs.value.length <= 0 || player1Status === playerStatuses.Cambiando || player2Status === playerStatuses.Cambiando
  )
})

const addRandomButtonDisabled = computed(() => {
  const player1Status = player1.value?.status
  const player2Status = player2.value?.status

  return (
    selectedSongs.value.length <= 1 || player1Status === playerStatuses.Cambiando || player2Status === playerStatuses.Cambiando
  )
})

// Define localstorage settings
if (!localStorage.getItem('vmusic_library_state')) {
  localStorage.setItem('vmusic_library_state', JSON.stringify(libraryState.value))
}

if (!localStorage.getItem('vmusic_settings')) {
  const initialSettings = {
    rowsPerPage: 24,
    rowsPerPageFs: 24,
    crossfaderTime: 1,
    recentlyAddedTime: 24,
    historyLimit: 15,
    previewSinkId: null,
    deckSinkId: null,
    baseSpeed: 0,
    colorSchema: COLOR_SCHEMA_DEFAULT
  }
  localStorage.setItem('vmusic_settings', JSON.stringify(initialSettings))
}

const onSelectChange = (selectedRowKeys) => {
  selectedSongs.value = selectedRowKeys
}

const onHistorySelectChange = (selectedRowKeys) => {
  historySelectedRows.value = selectedRowKeys
}

const onSelectAll = (selected, selectedRows, changeRows) => {
  const savedSettings = JSON.parse(localStorage.getItem('vmusic_settings'))
  if (selected) {
    setTimeout(() => {
      selectedSongs.value = filteredSongs2.value.map((item) => item.id)
    }, 0)
  } else {
    setTimeout(() => {
      selectedSongs.value = []
    }, 0)
    pageSizeRef.value = getRowsPerPageByMode(savedSettings)
  }
}

function getRowsPerPageByMode(settings = null) {
  const saved = settings || JSON.parse(localStorage.getItem('vmusic_settings')) || {}
  const normal = normalizeRowsPerPage(saved.rowsPerPage, 24)
  const fullscreen = normalizeRowsPerPage(saved.rowsPerPageFs, normal)

  return isWindowFullscreen.value ? fullscreen : normal
}

async function syncWindowDisplayMode() {
  if (!window.electron2?.getWindowDisplayMode) {
    isWindowFullscreen.value = Boolean(document.fullscreenElement)

    return
  }

  try {
    const mode = await window.electron2.getWindowDisplayMode()
    isWindowFullscreen.value = Boolean(mode?.isFullScreen)
  } catch (error) {
    isWindowFullscreen.value = Boolean(document.fullscreenElement)
  }
}

function formatHistoryPlayedAt(value) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

function normalizeSongForHistory(song) {
  if (!song) return null

  return {
    ...song,
    key: song.id,
    artistsJoined: Array.isArray(song.Artists) ? song.Artists.map((artist) => artist.name).join(', ') : '',
    composersJoined: Array.isArray(song.Composers) ? song.Composers.map((composer) => composer.name).join(', ') : ''
  }
}

function saveSongHistory() {
  localStorage.setItem(SONG_HISTORY_STORAGE_KEY, JSON.stringify(songHistory.value))
}

function loadSongHistory() {
  const stored = localStorage.getItem(SONG_HISTORY_STORAGE_KEY)
  if (!stored) {
    songHistory.value = []

    return
  }

  try {
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      songHistory.value = []

      return
    }
    songHistory.value = parsed
      .map((item) => ({
        ...normalizeSongForHistory(item),
        historyId: item.historyId || `${item.id}-${item.playedAt || Date.now()}-${Math.random().toString(16)
          .slice(2)}`,
        playedAt: item.playedAt || Date.now(),
        playedAtText: formatHistoryPlayedAt(item.playedAt || Date.now())
      }))
      .filter((item) => Boolean(item && item.id))
  } catch (error) {
    songHistory.value = []
  }
}

function recordSongToHistory(song) {
  const normalized = normalizeSongForHistory(song)
  if (!normalized || !normalized.id) return

  const playedAt = Date.now()
  const entry = {
    ...normalized,
    historyId: `${normalized.id}-${playedAt}-${Math.random().toString(16)
      .slice(2)}`,
    playedAt,
    playedAtText: formatHistoryPlayedAt(playedAt)
  }
  const limit = normalizeHistoryLimit(JSON.parse(localStorage.getItem('vmusic_settings'))?.historyLimit)
  songHistory.value = [entry, ...songHistory.value]
    .sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0))
    .slice(0, limit)
  saveSongHistory()
}

loadSongHistory()

onMounted(() => {
  // filterSongs()
  setInterval(function() {
    document.getElementById('logo').classList.add('jello-horizontal')
    setTimeout(function() {
      document.getElementById('logo').classList.remove('jello-horizontal')
    }, 1000)
  }, 10000)
})

let downloadCountInterval = null
function refreshDownloadCount() {
  const stored = localStorage.getItem(DOWNLOAD_TASKS_STORAGE_KEY)
  if (!stored) {
    downloadTasksCount.value = 0

    return
  }
  try {
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      const now = Date.now()
      const filtered = parsed.filter((task) => {
        if (task.status === 'done' || task.status === 'error') return false
        const updatedAt = typeof task.updatedAt === 'number' ? task.updatedAt : (typeof task.createdAt === 'number' ? task.createdAt : 0)
        if (!updatedAt) return false

        return (now - updatedAt) <= DOWNLOAD_TASK_TIMEOUT_MS
      })
      if (filtered.length !== parsed.filter((task) => task.status !== 'done' && task.status !== 'error').length) {
        localStorage.setItem(DOWNLOAD_TASKS_STORAGE_KEY, JSON.stringify([
          ...parsed.filter((task) => task.status === 'done' || task.status === 'error'),
          ...filtered
        ]))
      }
      downloadTasksCount.value = filtered.length
    } else {
      downloadTasksCount.value = 0
    }
  } catch (error) {
    downloadTasksCount.value = 0
  }
}

onMounted(() => {
  refreshDownloadCount()
  downloadCountInterval = setInterval(refreshDownloadCount, 1000)
})

onUnmounted(() => {
  if (downloadCountInterval) {
    clearInterval(downloadCountInterval)
    downloadCountInterval = null
  }
})

onMounted(() => {
  setupMediaSessionHandlers()
  updateMediaSessionState()
  updateMediaSessionMetadata()
  syncWindowDisplayMode().finally(() => {
    pageSizeRef.value = getRowsPerPageByMode()
  })
  if (window.electron2?.ipcRenderer?.on) {
    window.electron2.ipcRenderer.on('window-display-mode-changed', onWindowDisplayModeChanged)
    window.electron2.ipcRenderer.on('window-fullscreen-changed', onFullscreenChanged)
  }
  window.addEventListener('keydown', onHardwareMediaKey)
  window.addEventListener('resize', onWindowResizeRedrawPlayers)
  window.addEventListener('fullscreenchange', onWindowResizeRedrawPlayers)
})

onUnmounted(() => {
  clearMediaSessionHandlers()
  if (window.electron2?.ipcRenderer?.removeListener) {
    window.electron2.ipcRenderer.removeListener('window-display-mode-changed', onWindowDisplayModeChanged)
    window.electron2.ipcRenderer.removeListener('window-fullscreen-changed', onFullscreenChanged)
  }
  window.removeEventListener('keydown', onHardwareMediaKey)
  window.removeEventListener('resize', onWindowResizeRedrawPlayers)
  window.removeEventListener('fullscreenchange', onWindowResizeRedrawPlayers)
  if (playersResizeRafId) {
    cancelAnimationFrame(playersResizeRafId)
    playersResizeRafId = null
  }
})

function onFullscreenChanged(_event, isFullscreen) {
  isWindowFullscreen.value = Boolean(isFullscreen)
  pageSizeRef.value = getRowsPerPageByMode()
}

function onWindowDisplayModeChanged(_event, mode) {
  isWindowFullscreen.value = Boolean(mode?.isFullScreen)
  pageSizeRef.value = getRowsPerPageByMode()
}

function onWindowResizeRedrawPlayers() {
  syncWindowDisplayMode().finally(() => {
    pageSizeRef.value = getRowsPerPageByMode()
  })
  if (playersResizeRafId) {
    cancelAnimationFrame(playersResizeRafId)
  }
  playersResizeRafId = requestAnimationFrame(() => {
    playersResizeRafId = null
    player1.value?.refreshWaveform?.()
    player2.value?.refreshWaveform?.()
  })
}

watch(autopause, (newValue) => {
  if (newValue) {
    if (player1.value.status === playerStatuses.Reproduciendo) {
      player2.value.status = playerStatuses.Pausado
    } else if (player2.value.status === playerStatuses.Reproduciendo) {
      player1.value.status = playerStatuses.Pausado
    }
  }
})

watch(playlistDetails, () => {
  if (playlistSearchQuery.value.trim().length > 0) {
    updatePlaylistSearch()
  } else {
    playlistSearchResults.value = []
    playlistSearchIndex.value = 0
  }
})

watch(recentSongHistory, (rows) => {
  const validIds = new Set(rows.map((row) => row.historyId))
  historySelectedRows.value = historySelectedRows.value.filter((key) => validIds.has(key))
})

watch(() => [
  player1.value?.status,
  player2.value?.status,
  player1.value?.songFull?.id,
  player2.value?.songFull?.id
], () => {
  updateMediaSessionState()
  updateMediaSessionMetadata()
})

const removeAccents = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function onSearchBlur(searchValue) {
  saveLibraryView()
}

const state = reactive({
  selectedRowKeys: []
})

function formatMeridiemLabel(time) {
  return time
    .replace('AM', 'A.M.')
    .replace('PM', 'P.M.')
}

const playlistEtaText = computed(() => {
  const a = dayjs()
  let left = 0
  let left0 = 0
  let left1 = 0
  let left2 = 0

  if (playlistDetails.value.length > 0) {
    left0 = playlistDetails.value.reduce((n, { duration }) => n + duration, 0)
  }

  if (player1.value && player1.value.left && player1.value.status !== playerStatuses['Sin Carga']) {
    left1 = player1.value.left
  }

  if (player2.value && player2.value.left && player2.value.status !== playerStatuses['Sin Carga']) {
    left2 = player2.value.left
  }

  left = left0 + left1 + left2
  if (left <= 0) return null

  const b = a.add(left, 'second')
  const dayDiff = b.startOf('day').diff(a.startOf('day'), 'day')
  const formattedTime = formatMeridiemLabel(b.format('h:mm A'))

  if (dayDiff <= 0) {
    return `Hoy a las ${formattedTime}`
  }

  if (dayDiff === 1) {
    return `Mañana a las ${formattedTime}`
  }

  if (dayDiff === 2) {
    return `Pasado mañana a las ${formattedTime}`
  }

  return `Aproximadamente en ${dayDiff} días`
})

async function requestOutputDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return []

  try {
    let devices = await navigator.mediaDevices.enumerateDevices()
    const hasLabels = devices.some((d) => d.label && d.label.length > 0)

    if (!hasLabels && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      devices = await navigator.mediaDevices.enumerateDevices()
      stream.getTracks().forEach((track) => track.stop())
    }

    return devices.filter((d) => d.kind === 'audiooutput')
  } catch (error) {
    console.warn('No se pudieron obtener dispositivos de salida', error)

    return []
  }
}

async function loadPreviewOutputs() {
  const outputs = await requestOutputDevices()
  const options = outputs.map((d) => ({
    label: d.label || 'Salida predeterminada',
    value: d.deviceId
  }))

  previewOutputs.value = [
    { label: 'Predeterminada (sistema)', value: 'default' },
    ...options
  ]
}

async function ensurePreviewPlayer() {
  if (previewAudio.value) return previewAudio.value

  const audio = new Audio()
  audio.preload = 'auto'
  audio.crossOrigin = 'anonymous'
  audio.addEventListener('ended', () => resetPreviewState())
  audio.addEventListener('error', () => resetPreviewState())

  previewAudio.value = audio
  await loadPreviewOutputs()

  return audio
}

async function preparePreviewOutput() {
  try {
    await ensurePreviewPlayer()
  } catch (error) {
    console.warn('No se pudo inicializar el reproductor de previsualización', error)
  }
}

async function onPreviewDropdown(open) {
  if (!open) return
  await loadPreviewOutputs()
}

async function onPreviewSinkChange(deviceId) {
  previewSinkId.value = deviceId === 'default' ? null : deviceId
  if (!previewAudio.value) {
    await ensurePreviewPlayer()
  }

  if (previewAudio.value && typeof previewAudio.value.setSinkId === 'function' && previewSinkId.value) {
    try {
      await previewAudio.value.setSinkId(previewSinkId.value)
    } catch (error) {
      console.warn('No se pudo cambiar la salida de preview', error)
      alert('No se pudo cambiar la salida de previsualización.')
    }
  }
}

function resetPreviewState() {
  previewStatus.value = 'idle'
  isPreviewLoading.value = false
  previewSongId.value = null
  previewPlaylistEntryId.value = null
}

function stopPreview() {
  if (!previewAudio.value) return

  previewAudio.value.pause()
  previewAudio.value.currentTime = 0
  resetPreviewState()
}

async function startPreview(song, options = {}) {
  const { playlistEntryId = null } = options
  const audio = await ensurePreviewPlayer()

  isPreviewLoading.value = true
  try {
    if (previewStatus.value === 'playing') {
      audio.pause()
    }

    if (previewSinkId.value && typeof audio.setSinkId === 'function') {
      try {
        await audio.setSinkId(previewSinkId.value)
      } catch (error) {
        console.warn('No se pudo aplicar la salida de preview seleccionada', error)
      }
    }

    previewSongId.value = song.id
    previewPlaylistEntryId.value = playlistEntryId
    previewStatus.value = 'loading'
    audio.src = `http://localhost:3000/static/${song.folder}/${song.ytid}.mp3`
    const startAt = typeof song.start === 'number' ? song.start : 0
    if (startAt > 0) {
      const seekToStart = () => {
        const maxStart = Number.isFinite(audio.duration) ? Math.max(0, audio.duration - 0.01) : startAt
        audio.currentTime = Math.min(startAt, maxStart)
      }
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        seekToStart()
      } else {
        audio.addEventListener('loadedmetadata', seekToStart, { once: true })
      }
    }
    await audio.play()
    previewStatus.value = 'playing'
  } catch (error) {
    console.error(error)
    resetPreviewState()
    alert('No se pudo reproducir la previsualización en los audífonos.')
  } finally {
    isPreviewLoading.value = false
  }
}

function isPlaylistEntryPreviewing(song) {
  return previewPlaylistEntryId.value === song.entryId && previewStatus.value === 'playing'
}

function remove(array, element) {
  const index = array.findIndex((item) => item.entryId === element)
  if (index === -1) return

  const entry = array[index]
  array.splice(index, 1)

  const playlistIndex = playlist.value.findIndex((songId) => songId === entry.id)
  if (playlistIndex !== -1) {
    playlist.value.splice(playlistIndex, 1)
  }

  selectedRows.value = []
}

function removeAll(array) {
  playlist.value = []
  playlistDetails.value = []
  selectedRows.value = []
}

function move(array, index, delta) {
  if (index < 0) return
  let newIndex = index + delta
  if (newIndex < 0 || newIndex == array.length) return
  let indexes = [index, newIndex].sort((a, b) => a - b)
  array.splice(indexes[0], 2, array[indexes[1]], array[indexes[0]])
}

function moveFirst(array, element) {
  const index = array.findIndex((item) => item.entryId === element)
  if (index === -1) return

  const [found] = array.splice(index, 1)
  array.unshift(found)
}

function moveUp(array, element) {
  const index = array.findIndex((item) => item.entryId === element)
  move(array, index, -1)
}

function moveDown(array, element) {
  const index = array.findIndex((item) => item.entryId === element)
  move(array, index, 1)
}

function reset() {
  filterQuery.value = ''
  selectedSongs.value = []
  filteredSongs.value = []
  songs.value = []
}

function saveLibraryView(currentPage = null, sorter = null) {
  let currentLibraryState = null
  if (localStorage.getItem('vmusic_library_state')) {
    currentLibraryState = JSON.parse(localStorage.getItem('vmusic_library_state'))
  }

  let p = 1
  if (currentPage) {
    p = currentPage
  } else if (currentLibraryState.page) {
    p = currentLibraryState.page
  }

  let s = {}
  if (sorter) {
    s = { column: sorter.field, order: sorter.order }
  } else if (currentLibraryState.sort) {
    s = currentLibraryState.sort
  }

  libraryState.value = {
    tags: selectedTags.value,
    artists: selectedArtists.value,
    page: p,
    search: filterQuery.value,
    sort: s
  }

  localStorage.setItem('vmusic_library_state', JSON.stringify(libraryState.value))
}

async function setOption(option, extraArtists = [], recent = false) {
  stopPreview()
  reset()
  currentSelectedOption.value = option

  if (currentSelectedOption.value === options.library) {
    isLoadingLibrary.value = true
    preparePreviewOutput()
    await syncWindowDisplayMode()

    // Load library status
    libraryState.value = {}

    if (localStorage.getItem('vmusic_library_state')) {
      libraryState.value = JSON.parse(localStorage.getItem('vmusic_library_state'))
    }
    if (!libraryState.value.page) {
      libraryState.value.page = 1
    }

    const savedSettings = JSON.parse(localStorage.getItem('vmusic_settings'))

    await fetch('http://localhost:3000/songs/update-tags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(savedSettings)
    })

    pageSizeRef.value = getRowsPerPageByMode(savedSettings)

    if (songs.value.length <= 0 || tags.value.length <= 0 || artists.value.length <= 0) {
      // Set all tags
      tags.value = await getTags()

      // Set all artists
      artists.value = await getArtists(true)

      if (libraryState.value.artists.length > 0 || libraryState.value.tags.length > 0) {
        selectedArtists.value = libraryState.value.artists
        selectedTags.value = libraryState.value.tags
      } else {
        selectedTags.value = tags.value
          .filter((item) => !excludedTags.value.includes(item.id))
          .map((item) => item.id)
        selectedArtists.value = artists.value.map((a) => (a.id))
      }
    }

    if (extraArtists.length > 0) {
      selectedArtists.value.push(...extraArtists)
    }

    if (recent) {
      selectedTags.value = [9998]
    }

    await filterSongs()
  } else if (currentSelectedOption.value === options.download) {
    tags.value = await getTags()
    artists.value = await getArtists(true)

    // reset()
  } else if (currentSelectedOption.value === options.history) {
    historySelectedRows.value = []
    loadSongHistory()
  } else if (currentSelectedOption.value === options.tags) {
    getTags()
  }
}

function hideMenu(evt) {
  if (evt.target.classList.contains('backdrop')) {
    stopPreview()
    currentSelectedOption.value = null
    reset()
  }
}

/* Tags*/
async function getTags() {
  const response = await fetch('http://localhost:3000/tags')
  const data = await response.json()

  return data.sort((a, b) => a.name.localeCompare(b.name))
}

async function getArtists(filter = false) {
  const response = await fetch('http://localhost:3000/artists')
  const data = await response.json()

  return data.sort((a, b) => a.name.localeCompare(b.name))
}

/*
 *watch(tags, () => {
 *if (libraryState.value && libraryState.value.tags.length > 0) {
 *  selectedTags.value = libraryState.value.tags
 *} else {
 *  selectedTags.value = tags.value.map((item) => item.id)
 *}
 *filterSongs()
 *})
 */

async function filterSongs() {
  /*
   *const params = {
   *artists: selectedArtists.value,
   *tags: selectedTags.value
   *}
   *
   *const options = {
   *headers: {
   *  'Content-Type': 'application/json'
   *},
   *method: 'POST',
   *body: JSON.stringify(params)
   *}
   *
   *const response = await fetch('http://localhost:3000/songs/filter', options)
   *const data = await response.json()
   *
   *let localSongs = data.sort((a, b) => a.name.localeCompare(b.name))
   *
   *localSongs.forEach((item) => {
   *item.key = item.id
   *item.artistsJoined = item.Artists.map((i) => i.name).join(', ')
   *})
   *
   *filteredSongs.value = localSongs
   *songs.value = localSongs
   *
   *if (libraryState.value && libraryState.value.search?.length > 0) {
   *filterQuery.value = libraryState.value.search
   *searchManually()
   *}
   */
  const params = {
    artists: selectedArtists.value,
    tags: selectedTags.value
  }

  const options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify(params)
  }

  const response = await fetch('http://localhost:3000/songs/filter', options)
  const data = await response.json()

  songs.value = data.map((item) => ({
    ...item,
    key: item.id,
    artistsJoined: item.Artists.map((artist) => artist.name).join(', '),
    composersJoined: item.Composers.map((composer) => composer.name).join(', ')
  }))

  if (libraryState.value && libraryState.value.search?.length > 0) {
    filterQuery.value = libraryState.value.search

    // searchManually()
  }

  // tags.value = data.tags.sort((a, b) => a.name.localeCompare(b.name))


  const pageSize = pageSizeRef.value || 24
  const totalPages = Math.max(1, Math.ceil((filteredSongs2.value.length || 1) / pageSize))
  if (!libraryState.value.page || libraryState.value.page > totalPages) {
    libraryState.value.page = totalPages
  }

  saveLibraryView()
  isLoadingLibrary.value = false
}

/*
 *async function filterSongs())
 *filteredSongs.value = []
 *
 *const params = {
 *  artists: selectedArtists.value,
 *  tags: selectedTags.value
 *}
 *
 *const options = {
 *  headers: {
 *    'Content-Type': 'application/json'
 *  },
 *  method: 'POST',
 *  body: JSON.stringify(params)
 *}
 *
 *const response = await fetch('http://localhost:3000/songs/filter-by-artist', options)
 *const data = await response.json()
 *
 * // const localSongs = data.songs.sort((a, b) => a.name.localeCompare(b.name))
 *data.songs.forEach((item) => {
 *  item.key = item.id
 *  item.artistsJoined = item.Artists.map((artist) => artist.name).join(', ')
 *  item.composersJoined = item.Composers.map((composer) => composer.name).join(', ')
 *})
 *
 *songs.value = data.songs
 *
 * // tags.value = data.tags.sort((a, b) => a.name.localeCompare(b.name))
 *
 * // Update column order
 *if (libraryState.value.hasOwnProperty('sort') && Object.keys(libraryState.value.sort).length > 0) {
 *  columns.value.forEach((col) => {
 *    col.sortOrder = null
 *  })
 *  const foundCol = columns.value.find((item) => item.dataIndex.trim() === libraryState.value.sort.column.trim())
 *  foundCol.sortOrder = libraryState.value.sort.order
 *}
 *
 *filteredSongs.value = data.songs
 *saveLibraryView()
 *
 *isLoadingLibrary.value = false
 *}
 */

const showMenu = ref(false)

const closeContextMenu = () => {
  showMenu.value = false
}

function deleteSong() {
  if (selectedSongs.value.length === 0) return
  const songIdToDelete = selectedSongs.value[0]

  axios
    .post('http://localhost:3000/songs/delete', {
      id: songIdToDelete
    })
    .then(function(response) {
      filteredSongs.value = filteredSongs.value.filter((song) => song.id !== response.data[0])
      deletedSongs.value.push(response.data[0])
      markSongAsDeleted(songIdToDelete)
    })
    .catch(function(error) {})
    .finally(function() {
      selectedSongs.value = []
    })
}

function markSongAsDeleted(id) {
  const rows = document.querySelectorAll('.ant-table-row')
  rows.forEach((row) => {
    const key = row.getAttribute('data-row-key')
    if (Number(key) === id) {
      row.querySelectorAll('td').forEach((cell) => cell.classList.add('line-through'))
    }
  })
}

const shuffle = (array) => {
  return array.sort(() => Math.random() - 0.5)
}

function shufflePlaylist() {
  if (playlistDetails.value.length <= 1) return

  const shuffled = [...playlistDetails.value]

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  playlistDetails.value = shuffled
  playlist.value = shuffled.map((item) => item.id)

  if (selectedRows.value.length > 0) {
    const stillPresent = selectedRows.value.filter((entryId) => shuffled.some((item) => item.entryId === entryId))
    selectedRows.value = stillPresent
  }
}

function openM3UPicker() {
  if (isImportingM3U.value) {
    return
  }
  if (m3uInput.value) {
    m3uInput.value.click()
  }
}

async function onM3UFileChange(event) {
  const file = event.target.files && event.target.files[0]
  if (!file) {
    return
  }

  isImportingM3U.value = true

  try {
    const content = await file.text()
    await importM3UContent(content)
  } catch (error) {
    console.log(error)
    alert('No se pudo leer el archivo M3U.')
  } finally {
    event.target.value = ''
    isImportingM3U.value = false
  }
}

async function loadSongsForImport() {
  if (importSongsCacheLoaded.value && importSongsCache.value.length > 0) {
    return importSongsCache.value
  }

  const resolvedTags = tags.value.length > 0 ? tags.value : await getTags()
  const resolvedArtists = artists.value.length > 0 ? artists.value : await getArtists(true)

  if (tags.value.length === 0) {
    tags.value = resolvedTags
  }

  if (artists.value.length === 0) {
    artists.value = resolvedArtists
  }

  const params = {
    artists: resolvedArtists.map((artist) => artist.id),
    tags: resolvedTags.map((tag) => tag.id)
  }

  const options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify(params)
  }

  const response = await fetch('http://localhost:3000/songs/filter', options)
  const data = await response.json()
  importSongsCache.value = data
  importSongsCacheLoaded.value = true

  return importSongsCache.value
}

function parseM3U(content) {
  const entries = []

  if (!content) {
    return entries
  }

  const lines = content.split(/\r?\n/)
  let lastInfo = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('#EXTINF:')) {
      const info = line.slice(8)
      const [durationStr, ...rest] = info.split(',')
      const duration = parseInt(durationStr, 10)
      lastInfo = {
        duration: isNaN(duration) ? null : duration,
        title: rest.join(',').trim()
      }
    } else if (!line.startsWith('#')) {
      entries.push({
        ...lastInfo,
        path: line
      })
      lastInfo = null
    }
  }

  return entries
}

function getSongPathInfo(path) {
  if (!path) {
    return null
  }

  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length < 2) {
    return null
  }

  const filename = parts.pop()
  const folder = parts.pop()

  if (!filename || !folder) {
    return null
  }

  const ytid = filename.replace(/\.[^/.]+$/, '')

  return { folder, ytid }
}

async function importM3UContent(content) {
  const entries = parseM3U(content)
  if (entries.length === 0) {
    alert('El archivo M3U no contiene canciones válidas.')

    return
  }

  const allSongs = await loadSongsForImport()
  const songMap = new Map()

  allSongs.forEach((song) => {
    songMap.set(`${song.folder}/${song.ytid}`, song)
  })
  const matched = []
  const missing = []

  entries.forEach((entry) => {
    const info = getSongPathInfo(entry.path)
    if (!info) {
      missing.push(entry.path)

      return
    }

    const found = songMap.get(`${info.folder}/${info.ytid}`)
    if (found) {
      matched.push(found)
    } else {
      missing.push(entry.path)
    }
  })

  if (matched.length > 0) {
    matched.forEach((song) => {
      playlist.value.push(song.id)
    })

    const temp = matched.map((song) => createPlaylistEntry(song))
    temp.forEach((song) => {
      playlistDetails.value.push(song)
    })

    loadPlayers()
  }

  if (missing.length > 0) {
    alert(`No se pudieron cargar ${missing.length} canciones del archivo M3U.`)
  } else if (matched.length > 0) {
    alert(`Se agregaron ${matched.length} canciones desde el archivo M3U.`)
  }
}

function buildM3UContent(list) {
  const lines = ['#EXTM3U']

  list.forEach((song) => {
    const duration = Math.round(song.duration || 0)
    const artistsJoined = song.Artists?.map((a) => a.name).join(', ') || 'Desconocido'
    const availableTags = tags.value || []
    const genre = (song.Tags || [])
      .map((t) => {
        if (typeof t === 'number') {
          return availableTags.find((tag) => tag.id === t)?.name
        }

        return t?.name
      })
      .map((name) => (name || '').trim())
      .filter((name) => {
        if (!name) return false
        const normalized = name.toLowerCase()

        return normalized !== 'reciente' && normalized !== 'agregado-reciente'
      })
      .join(', ')
    const title = `${artistsJoined} - ${song.name}${genre ? ' - ' + genre : ''}`
    const path = `/media/${song.folder}/${song.ytid}.mp3`

    lines.push(`#EXTINF:${duration},${title}`)
    lines.push(path)
  })

  return lines.join('\n')
}

async function exportM3U() {
  if (isExportingM3U.value) {
    return
  }

  if (!filteredSongs2.value || filteredSongs2.value.length === 0) {
    alert('No hay canciones para exportar.')

    return
  }

  isExportingM3U.value = true

  try {
    if (tags.value.length === 0) {
      tags.value = await getTags()
    }

    const ids = filteredSongs2.value.map((s) => s.id)
    let detailedSongs = []

    try {
      const response = await axios.post('http://localhost:3000/songs/by-id', { ids })
      detailedSongs = response.data
    } catch (err) {
      console.log(err)
    }

    let songsForExport = detailedSongs.length > 0 ? detailedSongs : filteredSongs2.value

    if (m3uExportSourceFilter.value === 'apple') {
      songsForExport = songsForExport.filter((song) => Boolean(song.isAppleMusic))
    } else if (m3uExportSourceFilter.value === 'youtube') {
      songsForExport = songsForExport.filter((song) => !Boolean(song.isAppleMusic))
    }

    if (!songsForExport.length) {
      alert('No hay canciones que coincidan con la fuente seleccionada.')

      return
    }

    const content = buildM3UContent(songsForExport)
    const blob = new Blob([content], { type: 'audio/x-mpegurl' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'biblioteca.m3u'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.log(error)
    alert('No se pudo exportar la biblioteca en M3U.')
  } finally {
    isExportingM3U.value = false
  }
}

function addSongsToPlaylist(songIds, action, play = false, options = {}) {
  const { ignoreMarks = false } = options
  if (!Array.isArray(songIds) || songIds.length <= 0) return

  const ids = [...songIds]
  const savedSettings = JSON.parse(localStorage.getItem('vmusic_settings'))
  pageSizeRef.value = getRowsPerPageByMode(savedSettings)

  if (action === 0) {
    playlist.value = ids.concat(playlist.value)
  } else if (action === 1) {
    playlist.value = ids.concat(playlist.value)
  } else if (action === 2) {
    ids.forEach((song) => {
      playlist.value.push(song)
    })
  } else if (action === 3) {
    const shuffled = shuffle(ids)
    shuffled.forEach((song) => {
      playlist.value.push(song)
    })
  }

  axios
    .post('http://localhost:3000/songs/by-id', {
      ids
    })
    .then(function(response) {
      let temp = []
      ids.forEach((item) => {
        temp.push(response.data.filter((s) => s.id === item)[0])
      })

      const entries = temp.map((item) => createPlaylistEntry(item, { ignoreMarks }))

      if (action === 0) {
        playlistDetails.value = entries.concat(playlistDetails.value)
      } else if (action === 1) {
        playlistDetails.value = entries.concat(playlistDetails.value)
      } else if (action === 2) {
        entries.forEach((song) => {
          playlistDetails.value.push(song)
        })
      } else if (action === 3) {
        entries.forEach((song) => {
          playlistDetails.value.push(song)
        })
      }
    })
    .catch(function(error) {
      console.log(error)
    })
    .finally(function() {
      loadPlayers(play)
    })
}

function addToPlaylist(action, play = false, options = {}) {
  addSongsToPlaylist(selectedSongs.value, action, play, options)
}

function getSelectedHistorySongs() {
  const selected = new Set(historySelectedRows.value)

  return recentSongHistory.value.filter((song) => selected.has(song.historyId))
}

function addHistoryToPlaylist(action, options = {}) {
  const ids = getSelectedHistorySongs().map((song) => song.id)
  addSongsToPlaylist(ids, action, false, options)
}

function loadPlayers(play = false) {
  selectedSongs.value = []

  const player1Status = player1.value?.status
  const player2Status = player2.value?.status

  if (
    player1Status === playerStatuses.Detenido || player1Status === playerStatuses['Sin Carga']
  ) {
    let nextSong = getFirstUnplayedSong()
    if (nextSong && player1.value) {
      player1.value.setSong(nextSong)
    }
  }

  if (
    player2Status === playerStatuses.Detenido || player2Status === playerStatuses['Sin Carga']
  ) {
    let nextSong = getFirstUnplayedSong()
    if (nextSong && player2.value) {
      player2.value.setSong(nextSong)
    }
  }

  if (play) {
    if (isFirstPlay.value) {
      if (player1.value.status === playerStatuses.Listo) {
        isFirstPlay.value = false
        player1.value.play()
      }
    } else {
      if (!autopause.value) {
        if (player1.value.status === playerStatuses.Pausado) {
          player1.value.play()
        } else if (player2.value.status === playerStatuses.Pausado) {
          player2.value.play()
        }
      }
    }
  }
}

function loadDeck(deck) {
  const index = playlistDetails.value.findIndex((item) => item.entryId === selectedRows.value[0])
  if (index === -1) return

  const [found] = playlistDetails.value.splice(index, 1)
  const targetPlayer = deck === 'A' ? player1.value : player2.value
  const canSwapLoadedSong = targetPlayer && (targetPlayer.status === playerStatuses.Listo || targetPlayer.status === playerStatuses.Pausado)
  const canLoadDirectly = targetPlayer && (targetPlayer.status === playerStatuses.Detenido || targetPlayer.status === playerStatuses['Sin Carga'])

  if (canSwapLoadedSong) {
    const songToInsert = targetPlayer.songFull?.entryId ? targetPlayer.songFull : (targetPlayer.songFull ? createPlaylistEntry(targetPlayer.songFull) : null)
    if (songToInsert) {
      playlistDetails.value.splice(index, 0, songToInsert)
    }
    targetPlayer.setSong(found)
  } else if (canLoadDirectly) {
    targetPlayer.setSong(found)
  } else {
    // Revert removal if target deck cannot accept a manual load in current state.
    playlistDetails.value.splice(index, 0, found)
  }

  selectedRows.value = []
}

function isDeckManualLoadDisabled(deck) {
  if (deck === 'A') {
    return !player1.value || player1.value.status === playerStatuses.Reproduciendo || player1.value.status === playerStatuses.Cambiando
  }

  return !player2.value || player2.value.status === playerStatuses.Reproduciendo || player2.value.status === playerStatuses.Cambiando
}

function loadLibrarySongToDeck(song, deck) {
  if (!song) return

  const entry = song.entryId ? song : createPlaylistEntry(song)
  const targetPlayer = deck === 'A' ? player1.value : player2.value
  if (!targetPlayer) return

  if (
    targetPlayer.status === playerStatuses.Listo || targetPlayer.status === playerStatuses.Pausado || targetPlayer.status === playerStatuses.Detenido || targetPlayer.status === playerStatuses['Sin Carga']
  ) {
    targetPlayer.setSong(entry)
  }
}

function getFirstUnplayedSong() {
  if (playlistDetails.value.length > 0) {
    history.value.push(playlist.value.shift())
    let songFound = playlistDetails.value.shift()

    songFound.Tags.forEach((t) => {
      tagHistory.value.push(t.id)
    })

    return songFound
  }
}

function play() {
  if (!player1.value || !player2.value) return
  autopause.value = false

  if (isFirstPlay.value && player1.value.status === playerStatuses.Listo) {
    isFirstPlay.value = false
    player1.value.play()
  } else {
    if (!autopause.value) {
      if (player2.value.status === playerStatuses.Pausado) {
        player2.value.play()
      } else {
        player1.value.play()
      }
    }
  }
}

function pause() {
  if (!player1.value || !player2.value) return
  if (player1.value.status === playerStatuses.Reproduciendo) {
    player1.value.pause()
  }

  if (player2.value.status === playerStatuses.Reproduciendo) {
    player2.value.pause()
  }
}

function songFading(p) {
  if (p.position === 'top') {
    if ((player2.value.status === playerStatuses.Listo) && !autopause.value) {
      player2.value.play()
    }
  } else if (p.position === 'bottom') {
    if ((player1.value.status === playerStatuses.Listo) && !autopause.value) {
      player1.value.play()
    }
  } else {
    player1.value.stop()
    player2.value.stop()
  }
}

function checkPlayers(play = false) {
  const player1Status = player1.value?.status
  const player2Status = player2.value?.status

  if (
    player1Status === playerStatuses.Detenido || player1Status === playerStatuses['Sin Carga'] || player2Status === playerStatuses.Detenido || player2Status === playerStatuses['Sin Carga']
  ) {
    loadPlayers(play)
  }
}

function calcularPorcentaje(arr) {
  let frecuencia = {}
  arr.forEach((item) => {
    frecuencia[item] = (frecuencia[item] || 0) + 1
  })

  let porcentajes = {}
  Object.keys(frecuencia).forEach((item) => {
    const porcentaje = (frecuencia[item] / arr.length) * 100
    porcentajes[item] = porcentaje.toFixed(2)
  })

  return porcentajes
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max)
}

function selectRow(e, id) {
  if (e.metaKey) {
    if (!selectedRows.value.includes(id)) {
      selectedRows.value.push(id)
    }
  } else {
    selectedRows.value = []
    selectedRows.value.push(id)
  }
}

async function onPlaylistRowPressStart(song, event) {
  if (event && event.button !== undefined && event.button !== 0) return
  if (playlistPreviewPressTimer) {
    clearTimeout(playlistPreviewPressTimer)
    playlistPreviewPressTimer = null
  }

  isPlaylistPressPreviewActive = false
  playlistPreviewPressTimer = setTimeout(async() => {
    await startPreview(song, { playlistEntryId: song.entryId })
    isPlaylistPressPreviewActive = true
    playlistPreviewPressTimer = null
  }, PLAYLIST_PREVIEW_HOLD_MS)
}

function onPlaylistRowPressEnd() {
  if (playlistPreviewPressTimer) {
    clearTimeout(playlistPreviewPressTimer)
    playlistPreviewPressTimer = null
  }

  if (isPlaylistPressPreviewActive) {
    stopPreview()
    isPlaylistPressPreviewActive = false
  }
}

function onPlaylistSearchInput() {
  playlistSearchIndex.value = 0
  updatePlaylistSearch()
}

function updatePlaylistSearch() {
  const query = removeAccents(playlistSearchQuery.value.trim().toLowerCase())

  if (!query) {
    playlistSearchResults.value = []
    playlistSearchIndex.value = 0

    return
  }

  const matches = playlistDetails.value
    .map((song, index) => ({
      entryId: song.entryId,
      index,
      haystack: removeAccents(`${song.name} ${song.Artists.map((i) => i.name).join(' ')}`).toLowerCase()
    }))
    .filter((item) => item.haystack.includes(query))

  playlistSearchResults.value = matches

  if (matches.length > 0) {
    focusPlaylistResult(0)
  }
}

function focusPlaylistResult(targetIndex) {
  if (playlistSearchResults.value.length === 0) return

  const normalizedIndex = (targetIndex + playlistSearchResults.value.length) % playlistSearchResults.value.length
  playlistSearchIndex.value = normalizedIndex

  const result = playlistSearchResults.value[normalizedIndex]
  selectedRows.value = [result.entryId]

  nextTick(() => {
    const row = document.querySelector(`tr[data-entry-id="${result.entryId}"]`)
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

function nextPlaylistResult() {
  if (playlistSearchResults.value.length === 0) return
  focusPlaylistResult(playlistSearchIndex.value + 1)
}

function prevPlaylistResult() {
  if (playlistSearchResults.value.length === 0) return
  focusPlaylistResult(playlistSearchIndex.value - 1)
}

function hasRecentArtistMatch(song, index) {
  if (!song || index <= 0) return false
  const prev = playlistDetails.value[index - 1]
  if (!prev || !Array.isArray(song.Artists) || !Array.isArray(prev.Artists)) return false
  const prevIds = new Set(prev.Artists.map((artist) => artist.id))

  return song.Artists.some((artist) => prevIds.has(artist.id))
}

async function artistsUpdated(id) {
  artists.value = await getArtists(true)
  downloadSelectedArtist.value = id
}

async function downloaded(artistIds) {
  // Keep the download panel open; just refresh artists/tags cache.
  tags.value = await getTags()
  artists.value = await getArtists(true)
  downloadSelectedArtist.value = Array.isArray(artistIds) ? artistIds[0] : null
}

async function settingsSaved() {
  const s = JSON.parse(localStorage.getItem('vmusic_settings')) || {}
  previewSinkId.value = s.previewSinkId || null
  deckSinkId.value = s.deckSinkId || null
  excludedTags.value = s.excludeTags || []
  colorSchema.value = applyColorSchema(s.colorSchema)
  preparePreviewOutput()
  if (player1.value?.setSinkId && deckSinkId.value) {
    player1.value.setSinkId(deckSinkId.value)
  }
  if (player2.value?.setSinkId && deckSinkId.value) {
    player2.value.setSinkId(deckSinkId.value)
  }
  if (player1.value?.refreshBaseSpeed) {
    player1.value.refreshBaseSpeed()
  }
  if (player2.value?.refreshBaseSpeed) {
    player2.value.refreshBaseSpeed()
  }
  const historyLimit = normalizeHistoryLimit(s.historyLimit)
  songHistory.value = [...songHistory.value]
    .sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0))
    .slice(0, historyLimit)
  saveSongHistory()
  if (currentSelectedOption.value === options.library) {
    const allowed = selectedTags.value.filter((id) => !excludedTags.value.includes(id))
    selectedTags.value = allowed
    if (tagMultiSelect.value?.setSelected) {
      tagMultiSelect.value.setSelected(allowed)
    }
    filterSongs()
    saveLibraryView()
  }
  await syncWindowDisplayMode()
  pageSizeRef.value = getRowsPerPageByMode(s)
  setOption(null)
}

async function updated(songId) {
  const targetId = songId || selectedSongs.value[0]
  isLoadingLibrary.value = true
  await filterSongs()
  await refreshSongInLibrary(targetId)
  currentSelectedOption.value = options.library
  selectedSongs.value = []
  isLoadingLibrary.value = false
}

async function refreshSongInLibrary(id) {
  if (!id) return

  try {
    const response = await axios.get(`http://localhost:3000/songs/${id}`)
    const updatedSong = response.data
    const normalizedSong = {
      ...updatedSong,
      key: updatedSong.id,
      artistsJoined: updatedSong.Artists.map((artist) => artist.name).join(', '),
      composersJoined: updatedSong.Composers.map((composer) => composer.name).join(', ')
    }

    const index = songs.value.findIndex((song) => song.id === id)
    if (index !== -1) {
      songs.value.splice(index, 1, normalizedSong)
    }
  } catch (error) {
    console.log(error)
  }
}

function waveUpdated(markers) {
  axios
    .post('http://localhost:3000/songs/update-markers/' + selectedSongs.value[0], markers)
    .then(function(response) {})
    .catch(function(error) {
      console.log(error)
    })
    .finally(function() {
      selectedSongs.value = []
      setOption(options.library)
    })
}

function saveSpeed(p) {
  let id = null
  let speed = null

  if (p.position === 'top') {
    id = player1.value.songId
    speed = player1.value.speed_added
  } else {
    id = player2.value.songId
    speed = player2.value.speed_added
  }

  axios
    .post('http://localhost:3000/songs/save-speed', {
      id: id,
      speed: speed
    })
    .then(function(response) {})
}

function next() {
  if (!player1.value || !player2.value) return
  if (player1.value.status === playerStatuses.Reproduciendo) {
    player1.value.next()
  } else if (player2.value.status === playerStatuses.Reproduciendo) {
    player2.value.next()
  }
}

function getMediaTargetPlayer() {
  if (!player1.value || !player2.value) return null

  if (player1.value.status === playerStatuses.Reproduciendo) return player1.value
  if (player2.value.status === playerStatuses.Reproduciendo) return player2.value
  if (player1.value.status === playerStatuses.Pausado || player1.value.status === playerStatuses.Listo) return player1.value
  if (player2.value.status === playerStatuses.Pausado || player2.value.status === playerStatuses.Listo) return player2.value

  return null
}

function previousTrack() {
  const targetPlayer = getMediaTargetPlayer()
  if (!targetPlayer || typeof targetPlayer.restart !== 'function') return
  targetPlayer.restart()
}

function setMediaSessionActionHandler(action, handler) {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.setActionHandler(action, handler)
  } catch (error) {
    // Some platforms do not support all actions.
  }
}

function setupMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return

  setMediaSessionActionHandler('play', () => play())
  setMediaSessionActionHandler('pause', () => pause())
  setMediaSessionActionHandler('nexttrack', () => next())
  setMediaSessionActionHandler('previoustrack', () => previousTrack())
  setMediaSessionActionHandler('stop', () => pause())
}

function clearMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return
  mediaSessionActions.forEach((action) => setMediaSessionActionHandler(action, null))
}

function updateMediaSessionState() {
  if (!('mediaSession' in navigator)) return

  const playing = player1.value?.status === playerStatuses.Reproduciendo || player2.value?.status === playerStatuses.Reproduciendo
  const hasLoadedSong = Boolean(player1.value?.songFull?.id || player2.value?.songFull?.id)

  if (playing) {
    navigator.mediaSession.playbackState = 'playing'

    return
  }

  navigator.mediaSession.playbackState = hasLoadedSong ? 'paused' : 'none'
}

function updateMediaSessionMetadata() {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return

  const activePlayer = getMediaTargetPlayer()
  const song = activePlayer?.songFull

  if (!song?.id) {
    navigator.mediaSession.metadata = null

    return
  }

  const artistNames = Array.isArray(song.Artists) ? song.Artists.map((artist) => artist.name).join(', ') : ''
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.name || 'Sin canción',
    artist: artistNames || 'Sin artista',
    album: 'Salsamanía'
  })
}

function onHardwareMediaKey(event) {
  if (!mediaKeyCodes.has(event.code)) return
  try {
    event.preventDefault()

    if (event.code === 'MediaPlayPause') {
      if (player1.value?.status === playerStatuses.Reproduciendo || player2.value?.status === playerStatuses.Reproduciendo) {
        pause()
      } else {
        play()
      }

      return
    }

    if (event.code === 'MediaPlay') {
      play()

      return
    }

    if (event.code === 'MediaPause' || event.code === 'MediaStop') {
      pause()

      return
    }

    if (event.code === 'MediaTrackNext') {
      next()

      return
    }

    if (event.code === 'MediaTrackPrevious') {
      previousTrack()
    }
  } catch (error) {
    console.warn('Error al manejar media key', error)
  }
}

function artistsChanged(data) {
  libraryState.value.page = 1
  selectedArtists.value = data
  filterSongs()
  saveLibraryView()
}

function tagsChanged(data) {
  libraryState.value.page = 1
  selectedTags.value = data
  filterSongs()
  saveLibraryView()
}

function quickFilterByArtist(artistId) {
  // Select only the chosen artist and force all tags (including excluded ones)
  libraryState.value.page = 1
  selectedArtists.value = [artistId]
  selectedTags.value = tags.value.map((tag) => tag.id)
  filterQuery.value = ''
  m3uExportSourceFilter.value = 'any'
  filterSongs()
  saveLibraryView()
}

function selectAllArtists() {
  artistMultiSelect.value.selectAll()
}

function selectNoneArtists() {
  artistMultiSelect.value.selectNone()
}

function selectAllTags(evt) {
  const ignoreExclusions = evt?.altKey
  const allowed = tags.value
    .filter((t) => ignoreExclusions ? true : !excludedTags.value.includes(t.id))
    .map((t) => t.id)
  selectedTags.value = allowed
  if (tagMultiSelect.value?.setSelected) {
    tagMultiSelect.value.setSelected(allowed)
  } else {
    tagMultiSelect.value.selectAll()
  }
  libraryState.value.page = 1
  filterSongs()
  saveLibraryView()
}

function selectNoneTags() {
  tagMultiSelect.value.selectNone()
}

async function openLibraryForArtist(artistId) {
  await setOption(options.library)
  quickFilterByArtist(artistId)
}

async function openLibraryForSong(songData) {
  const songId = typeof songData === 'number' ? songData : songData?.id
  const songName = typeof songData === 'string' ? songData : songData?.name
  if (!songId && !songName) return

  await setOption(options.library)

  // Ensure the song is visible regardless of previous filters.
  selectedArtists.value = artists.value.map((a) => a.id)
  selectedTags.value = tags.value.map((tag) => tag.id)
  filterQuery.value = songName || ''
  m3uExportSourceFilter.value = 'any'
  libraryState.value.page = 1
  await filterSongs()

  let targetIndex = -1
  if (songId) {
    targetIndex = filteredSongs2.value.findIndex((item) => item.id === songId)
  }
  if (targetIndex === -1 && songName) {
    const normalized = removeAccents(songName.toLowerCase())
    targetIndex = filteredSongs2.value.findIndex((item) => removeAccents((item.name || '').toLowerCase()) === normalized)
  }

  if (targetIndex !== -1) {
    const pageSize = pageSizeRef.value || 24
    libraryState.value.page = Math.floor(targetIndex / pageSize) + 1
    selectedSongs.value = [filteredSongs2.value[targetIndex].id]
  } else {
    selectedSongs.value = []
  }

  saveLibraryView()
  await nextTick()
}

async function previewStartFromPlayer({ song, status }) {
  // Permitir preview solo si el deck correspondiente no está reproduciendo
  if (status === playerStatuses.Reproduciendo) return
  await startPreview(song)
}

function onSongFinished(song) {
  recordSongToHistory(song)
}

function onTableChange(pagination, filters, sorter, { action, currentDataSource }) {
  libraryState.value.page = pagination.current
  saveLibraryView(pagination.current, sorter)
}

function onM3uSourceSelect({ key }) {
  m3uExportSourceFilter.value = key
  libraryState.value.page = 1
  saveLibraryView()
}
</script>

<style>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  z-index: 51;
}

.overlay::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
}

.overlay:hover {
  cursor: pointer;
}

table tr td.ant-table-cell {
  padding: 2px 0 !important;
}

.ant-table-striped .table-striped td {
  background-color: var(--vm-table-stripe);
}

.ant-table-striped .table-deleted td {
  text-decoration: line-through !important;
  text-decoration-thickness: 1.5px;
}

.ant-table-pagination.ant-pagination {
  margin: 5px 0 0 0 !important;
}

.deck-a-indicator {
  color: var(--vm-player-wave-a);
}

.deck-b-indicator {
  color: var(--vm-player-wave-b);
}

.deck-a-badge {
  background-color: var(--vm-player-wave-a);
  color: var(--vm-player-text);
}

.deck-b-badge {
  background-color: var(--vm-player-wave-b);
  color: var(--vm-player-text);
}

.vm-logo svg {
  width: 100%;
  height: auto;
  display: block;
}

.playlist-row-selected {
  background-color: color-mix(in srgb, var(--vm-player-wave-a) 40%, transparent);
}

.vm-item-selected {
  background-color: var(--vm-neutral-row-selected) !important;
}

.vm-secondary-panel {
  --vm-neutral-accent: #57534e;
  --vm-neutral-accent-hover: #44403c;
  --vm-neutral-accent-soft: #292524;
  --vm-neutral-accent-ring: rgba(120, 113, 108, 0.28);
  --vm-secondary-surface: color-mix(in srgb, #d6d3d1 93%, var(--vm-player-wave-b) 7%);
  --vm-secondary-panel-bg: color-mix(in srgb, #e7e5e4 93%, var(--vm-player-wave-b) 7%);
  --vm-secondary-control: color-mix(in srgb, #78716c 92%, var(--vm-player-wave-b) 8%);
  --vm-secondary-control-alt: color-mix(in srgb, #a8a29e 92%, var(--vm-player-wave-b) 8%);
  --vm-secondary-row-base: color-mix(in srgb, #f0edeb 94%, var(--vm-player-wave-b) 6%);
  --vm-secondary-row-stripe: color-mix(in srgb, #ede9e6 93%, var(--vm-player-wave-b) 7%);
  --vm-neutral-row-selected: color-mix(in srgb, var(--vm-player-wave-b) 22%, #ffffff 78%);
  --vm-neutral-row-hover: color-mix(in srgb, var(--vm-player-wave-b) 15%, #ffffff 85%);
  --vm-bg-surface: var(--vm-secondary-surface);
  --vm-bg-panel: var(--vm-secondary-panel-bg);
  --vm-bg-control: var(--vm-secondary-control);
  --vm-bg-control-alt: var(--vm-secondary-control-alt);
  --vm-table-stripe: var(--vm-secondary-row-stripe);
  background-color: var(--vm-secondary-surface) !important;
}

.vm-secondary-panel.bg-gray-300 {
  background-color: var(--vm-secondary-surface) !important;
}

.vm-secondary-panel .bg-gray-300 {
  background-color: var(--vm-secondary-surface) !important;
}

.vm-secondary-panel .bg-gray-100 {
  background-color: var(--vm-secondary-panel-bg) !important;
}

.vm-secondary-panel .bg-gray-700,
.vm-secondary-panel .bg-gray-600,
.vm-secondary-panel .bg-gray-500 {
  background-color: var(--vm-secondary-control) !important;
}

#app .vmusic-app .vm-side-nav {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--vm-player-wave-a) 45%, black 55%) 0%,
    color-mix(in srgb, var(--vm-player-wave-b) 45%, black 55%) 100%
  ) !important;
  color: #ffffff !important;
}

#app .vmusic-app .vm-side-nav svg {
  color: #ffffff !important;
}

#app .vmusic-app .vm-side-nav .vm-item-selected,
#app .vmusic-app .vm-side-nav .vm-item-selected svg {
  color: #000000 !important;
}

#app .vmusic-app .vm-side-nav .vm-item-selected {
  background-color: color-mix(in srgb, #d6d3d1 93%, var(--vm-player-wave-b) 7%) !important;
}

</style>

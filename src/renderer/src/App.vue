<template>
  <a-config-provider :theme="antTheme">
    <!-- Overlay to close the menu -->
    <div
      v-if="showMenu"
      class="overlay"
      @click="closeContextMenu"
      @click.right="closeContextMenu"
    />

    <!-- Context menu for adding songs to playlists -->
    <div
      v-if="songContextMenu.visible"
      class="absolute bg-gray-900 z-[100] rounded shadow-lg border border-gray-700 min-w-[200px]"
      :style="{ top: songContextMenu.y + 'px', left: songContextMenu.x + 'px' }"
    >
      <div class="text-sm text-gray-400 px-3 py-2 border-b border-gray-700 truncate">
        Agregar a playlist
      </div>
      <div
        v-for="playlist in savedPlaylists"
        :key="playlist.id"
        class="px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 cursor-pointer text-sm"
        @click="addSongToPlaylist(playlist.id)"
      >
        {{ playlist.name }} ({{ playlist.songCount }})
      </div>
      <div class="border-t border-gray-700 mt-1">
        <div
          class="px-3 py-2 text-lime-400 hover:text-lime-300 hover:bg-gray-800 cursor-pointer text-sm"
          @click="createNewPlaylistWithSong"
        >
          + Crear nueva playlist...
        </div>
      </div>
    </div>

    <!-- Modal crear playlist rápida -->
    <a-modal
      v-model:open="quickCreatePlaylistModalVisible"
      title="Crear nueva playlist"
      :ok-text="'Crear'"
      :cancel-text="'Cancelar'"
      @ok="confirmQuickCreatePlaylist"
      @cancel="quickCreatePlaylistModalVisible = false"
    >
      <a-input v-model:value="quickPlaylistName" placeholder="Nombre de la playlist" />
    </a-modal>

    <div v-if="currentSelectedOption" class="backdrop z-50 fixed w-full h-full" @click="hideMenu">
      <div
        :class="{
          'w-9/12':
            currentSelectedOption === options.library || currentSelectedOption === options.history,
          'w-11/12': currentSelectedOption === options.wave,
          'w-2/5':
            currentSelectedOption !== options.wave &&
            currentSelectedOption !== options.library &&
            currentSelectedOption !== options.history
        }"
        class="vm-secondary-panel right-[40px] fixed flex h-full flex-col min-h-[0] bg-gray-300 p-6 text-black"
        @click="hideMenu"
      >
        <Edit
          v-if="currentSelectedOption && currentSelectedOption === options.edit"
          :id="selectedSongs.length > 0 ? selectedSongs[0] : 0"
          :tags="tags.filter((t) => t.id != 9998)"
          :artists="artists"
          @updated="updated"
        />

        <Download
          v-if="currentSelectedOption && currentSelectedOption === options.download"
          :tags="tags.filter((t) => t.id != 9998)"
          :artists="artists"
          :selected-artist="downloadSelectedArtist"
          @downloaded="downloaded"
          @artists-updated="artistsUpdated"
        />

        <div
          v-if="currentSelectedOption && currentSelectedOption === options.settings"
          class="flex-1 min-h-0 overflow-y-auto pr-2"
        >
          <Settings @saved="settingsSaved" />
        </div>

        <div
          v-if="currentSelectedOption && currentSelectedOption === options.changelog"
          class="flex-1 min-h-0 overflow-y-auto pr-2"
        >
          <Changelog />
        </div>

        <Artists v-if="currentSelectedOption && currentSelectedOption === options.artists" />

        <Tags
          v-if="currentSelectedOption && currentSelectedOption === options.tags"
          :tags="tags.filter((t) => t.id != 9998)"
          @added="getTags"
        />

        <AddMp3
          v-if="currentSelectedOption && currentSelectedOption === options.add_mp3"
          :tags="tags.filter((t) => t.id != 9998)"
          :artists="artists"
          @saved="onAddMp3Saved"
        />

        <Wave
          v-if="currentSelectedOption && currentSelectedOption === options.wave"
          :id="selectedSongs.length > 0 ? selectedSongs[0] : 0"
          :preview-sink-id="previewSinkId"
          @wave-updated="waveUpdated"
          @preview-play-state="onWavePreviewPlayState"
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

                <a-button size="small" @click="selectAllArtists"> Todos </a-button>

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

                <a-button size="small" @click="selectNoneArtists"> Ninguno </a-button>

                <a-switch
                  v-if="showAdvancedFunctions"
                  size="small"
                  :checked="artistFilterMode === 'all'"
                  checked-children="Intersección"
                  un-checked-children="Unión"
                  @change="artistFilterModeToggled"
                />
                <span class="text-xs text-black tabular-nums whitespace-nowrap">
                  {{ selectedArtists.length }}/{{ artists.length }}
                </span>
                <a-input
                  v-if="showAdvancedFunctions"
                  v-model:value="artistFilterQuery"
                  class="vm-filter-input vm-filter-input-compact flex-1 min-w-0"
                  placeholder="Filtrar artistas"
                  allow-clear
                />
              </div>

              <div class="bg-gray-300 flex-1 min-h-0">
                <multiselect
                  ref="artistMultiSelect"
                  name="artists"
                  :list="artists"
                  :alt-pressed="isAltPressed"
                  :filter-query="artistFilterQuery"
                  :selected-default="selectedArtists"
                  @changed="artistsChanged"
                />
              </div>
            </div>

            <div class="h-full flex-1 flex flex-col min-h-[0]">
              <div class="flex items-center space-x-2 text-xs text-white mb-2">
                <a-button size="small" @click="selectAllTags($event)"> Todos </a-button>

                <a-button size="small" @click="selectNoneTags"> Ninguno </a-button>

                <a-switch
                  v-if="showAdvancedFunctions"
                  size="small"
                  :checked="tagFilterMode === 'all'"
                  checked-children="Intersección"
                  un-checked-children="Unión"
                  @change="tagFilterModeToggled"
                />
                <span class="text-xs text-black tabular-nums whitespace-nowrap">
                  {{ selectedTags.length }}/{{ tags.length }}
                </span>
                <a-input
                  v-if="showAdvancedFunctions"
                  v-model:value="tagFilterQuery"
                  class="vm-filter-input vm-filter-input-compact flex-1 min-w-0"
                  placeholder="Filtrar tags"
                  allow-clear
                />
              </div>

              <div class="bg-gray-300 flex-1 min-h-0">
                <multiselect
                  ref="tagMultiSelect"
                  name="tags"
                  :list="tags"
                  :alt-pressed="isAltPressed"
                  :filter-query="tagFilterQuery"
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
                <i-mdi-plus class="w-5 h-5" />
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
                <i-mdi-shuffle class="w-4 h-4" />
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
                  <i-ic-baseline-move-up class="w-5 h-5" />
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
                  <i-ic-baseline-move-down class="w-5 h-5" />
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
                <i-material-symbols-info-outline class="w-5 h-5" />
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
                <i-iwwa-delete class="w-4 h-4" />
                Eliminar
              </a-button>
              <a-button
                v-if="false"
                :disabled="isExportingM3U || filteredSongs2.length === 0"
                class="flex items-center space-x-1 pl-2.5"
                @click="exportM3U"
              >
                <i-mdi-file-export-outline class="w-4 h-4" />
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
                  <a-menu :selected-keys="[m3uExportSourceFilter]" @click="onM3uSourceSelect">
                    <a-menu-item key="any"> Cualquier fuente </a-menu-item>
                    <a-menu-item key="apple"> Apple Music </a-menu-item>
                    <a-menu-item key="youtube"> Youtube </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto">
            <a-table
              class="ant-table-striped"
              :animate-rows="false"
              :row-key="(record) => record.id"
              :row-class-name="
                (_record, index) =>
                  deletedSongsSet.has(_record.id)
                    ? 'table-deleted'
                    : index % 2 === 1
                      ? 'table-striped'
                      : null
              "
              :show-sorter-tooltip="false"
              :loading="isLoadingLibrary"
              :pagination="{
                current: libraryState.page,
                hideOnSinglePage: false,
                total: filteredSongs2.length,
                'show-total': (total) =>
                  `${selectedSongs.length} seleccionadas / ${total} canciones`,
                defaultPageSize: 24,
                pageSize: pageSizeRef,
                showSizeChanger: false
              }"
              :row-selection="{
                selectedRowKeys: selectedSongs,
                onChange: onSelectChange,
                onSelectAll: onSelectAll
              }"
              sticky
              size="small"
              :data-source="filteredSongs2"
              :columns="columns"
              @change="onTableChange"
            >
              <template #emptyText>
                <div class="min-h-[40px] leading-[40px]">No hay canciones que mostrar.</div>
              </template>
              <template #bodyCell="{ text, record, column }">
                <template v-if="column.dataIndex === 'preview'">
                  <div class="flex items-center justify-center gap-1">
                    <a-button
                      class="flex items-center justify-center w-8 h-8 p-0"
                      size="small"
                      :type="
                        previewSongId === record.id && previewStatus === 'playing'
                          ? 'primary'
                          : 'default'
                      "
                      :loading="isPreviewLoading && previewSongId === record.id"
                      @mousedown.stop.prevent="startPreview(record)"
                      @mouseup.stop="stopPreview()"
                      @mouseleave.stop="stopPreview()"
                      @touchstart.stop.prevent="startPreview(record)"
                      @touchend.stop="stopPreview()"
                    >
                      <i-mdi-headphones class="w-4 h-4" />
                    </a-button>
                    <a-button
                      class="flex items-center justify-center w-8 h-8 p-0"
                      size="small"
                      @click.stop="openWaveEditorForSong(record)"
                    >
                      <i-mdi-sine-wave class="w-4 h-4" />
                    </a-button>
                  </div>
                </template>
                <template v-else-if="column.dataIndex === 'name'">
                  <div
                    class="flex items-center space-x-2 cursor-pointer"
                    @contextmenu.prevent="openSongContextMenu($event, record)"
                  >
                    <span>{{ text }}</span>
                    <a-tooltip v-if="getSongNote(record)" placement="top">
                      <template #title>
                        <div class="vm-song-note-tooltip">
                          {{ getSongNote(record) }}
                        </div>
                      </template>
                      <span class="vm-song-note-indicator text-stone-700">
                        <i-mdi-file-document-outline class="w-4 h-4" />
                      </span>
                    </a-tooltip>
                    <span
                      v-if="record.Tags.some((tag) => tag.id === 9998)"
                      class="px-[10px] py-[1px] rounded-full bg-yellow-200 text-yellow-00 text-xs"
                      >Reciente</span
                    >
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
                <template v-else-if="column.dataIndex === 'playCount'">
                  <span class="tabular-nums text-center block">{{ record.playCount || 0 }}</span>
                </template>
                <template v-else-if="column.dataIndex === 'source'">
                  <i-ic-baseline-apple v-if="record.isAppleMusic" class="mx-auto w-5 h-5" />
                  <i-mingcute-youtube-fill v-else class="mx-auto w-5 h-5" />
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
              :row-key="(record) => record.historyId"
              :row-class-name="(_record, index) => (index % 2 === 1 ? 'table-striped' : null)"
              :show-sorter-tooltip="false"
              :pagination="false"
              sticky
              size="small"
              :data-source="recentSongHistory"
              :columns="historyColumns"
              :row-selection="{
                selectedRowKeys: historySelectedRows,
                onChange: onHistorySelectChange
              }"
            >
              <template #emptyText>
                <div class="min-h-[40px] leading-[40px]">No hay canciones en historial.</div>
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
                  <i-ic-baseline-apple v-if="record.isAppleMusic" class="mx-auto w-5 h-5" />
                  <i-mingcute-youtube-fill v-else class="mx-auto w-5 h-5" />
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

      <Playlists
        v-if="currentSelectedOption && currentSelectedOption === options.playlists"
        @load-playlist="onLoadPlaylist"
      />
    </div>

    <div v-if="customUpdaterBlocking" class="vm-update-screen">
      <div
        class="vm-update-shell"
        :class="{
          'vm-update-shell-error': customUpdaterDisplayState.status === 'error',
          'vm-update-shell-ready': customUpdaterDisplayState.status === 'downloaded'
        }"
      >
        <div class="vm-update-glow" />
        <div class="vm-update-status-row">
          <div
            class="vm-update-pill"
            :class="[
              `vm-update-pill-${customUpdaterDisplayState.status || 'idle'}`,
              { 'vm-update-pill-dev': customUpdaterPreviewActive }
            ]"
          >
            {{ customUpdaterStatusLabel }}
          </div>
          <div v-if="customUpdaterPreviewActive" class="vm-update-pill vm-update-pill-preview">
            Vista previa dev
          </div>
        </div>
        <div class="vm-update-brand">
          <div
            class="vm-update-mark"
            :class="{
              'vm-update-mark-error': customUpdaterDisplayState.status === 'error',
              'vm-update-mark-ready': customUpdaterDisplayState.status === 'downloaded'
            }"
          >
            <img
              :src="appIconUrl"
              alt="Salsamania"
              class="vm-update-mark-image"
              draggable="false"
            />
          </div>
          <div class="vm-update-name">Salsamania</div>
        </div>
        <div
          v-if="
            customUpdaterDisplayState.status !== 'downloaded' &&
            customUpdaterDisplayState.status !== 'error'
          "
          class="vm-update-spinner"
          aria-hidden="true"
        />
        <div
          class="vm-update-title"
          :class="{ 'vm-update-title-error': customUpdaterDisplayState.status === 'error' }"
        >
          {{ customUpdaterTitle }}
        </div>
        <div
          class="vm-update-message"
          :class="{ 'vm-update-message-error': customUpdaterDisplayState.status === 'error' }"
        >
          {{ customUpdaterMessage }}
        </div>
        <div v-if="customUpdaterDisplayState.version" class="vm-update-version">
          Version {{ customUpdaterDisplayState.version }}
        </div>
        <div v-if="customUpdaterProgressVisible" class="vm-update-progress">
          <div class="vm-update-progress-bar">
            <div
              class="vm-update-progress-fill"
              :style="{ width: `${customUpdaterProgressValue}%` }"
            />
          </div>
          <div class="vm-update-progress-caption">
            {{ customUpdaterProgressCaption }}
          </div>
        </div>
        <div class="vm-update-meta">
          <div class="vm-update-meta-card">
            <span class="vm-update-meta-label">Estado</span>
            <span class="vm-update-meta-value">{{ customUpdaterStatusDetail }}</span>
          </div>
        </div>
        <div class="vm-update-actions">
          <a-button
            v-if="customUpdaterDisplayState.status === 'downloaded' && !customUpdaterPreviewActive"
            type="primary"
            size="large"
            @click="installCustomUpdaterNow()"
          >
            Instalar ahora
          </a-button>
          <a-button
            v-if="customUpdaterDisplayState.status === 'error' && !customUpdaterPreviewActive"
            danger
            size="large"
            @click="checkCustomUpdater()"
          >
            Reintentar
          </a-button>
          <a-button
            v-if="customUpdaterPreviewActive"
            size="large"
            @click="clearCustomUpdaterPreview()"
          >
            Cerrar vista previa
          </a-button>
        </div>
      </div>
    </div>

    <div v-else class="vmusic-app flex items-stretch min-w-0">
      <div class="flex-[5] flex flex-col min-w-0 min-h-0 overflow-hidden p-6 gap-4">
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
          @song-click="openInfoForSong"
          @preview-start="previewStartFromPlayer"
          @preview-stop="stopPreview"
          @loaded="handlePlayerLoaded(player1); checkPlayers(player1)"
          @stopped="checkPlayers(player1)"
          @finished="onSongFinished"
          @fading="songFading(player1)"
          @speed="saveSpeed(player1)"
          @cover-updated="coverUpdated"
          @timeupdate="(t) => handleLyricsTimeupdate('top', t)"
        />
        <div class="vm-center-stage flex-1">
          <div
            v-if="shouldShowCenterVisualizer"
            :class="[
              'vm-center-visualizer',
              centerVisualizerDeckClass,
              { 'is-playing': centerVisualizerAnimating }
            ]"
          >
            <div class="vm-center-content">
              <div class="vm-center-meter">
                <div class="vm-center-bars-wrap">
                  <div class="vm-center-times">
                    {{ centerVisualizerTimeText }}
                  </div>
                  <div class="vm-center-rms-bars" aria-hidden="true">
                    <span
                      v-for="(height, index) in centerVisualizerBarHeights"
                      :key="index"
                      class="vm-center-rms-bar"
                      :style="{ transform: `scaleY(${height})` }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            v-else-if="shouldShowLyrics"
            class="vm-lyrics-panel flex flex-col items-center justify-center px-8 py-4 select-none overflow-hidden"
          >
            <div
              v-if="lyricsLoading"
              class="text-gray-400 text-lg"
            >
              Cargando letra...
            </div>
            <template v-else-if="activeLyricsLine">
              <div
                v-if="currentLyricsWord"
                class="vm-lyrics-word text-white font-bold text-center leading-none transition-all duration-300"
                style="font-size: clamp(2.5rem, 6vw, 5rem)"
              >
                {{ currentLyricsWord }}
              </div>
              <div
                v-if="currentLyricsWord"
                class="vm-lyrics-fullline text-gray-500 text-base text-center leading-relaxed mt-4 max-w-lg"
              >
                {{ activeLyricsLine }}
              </div>
              <div
                v-else
                class="vm-lyrics-fullline text-white text-2xl font-bold text-center leading-relaxed px-4"
              >
                {{ activeLyricsLine }}
              </div>
              <div
                v-if="nextLyricsLine"
                class="vm-lyrics-nextline text-gray-600 text-sm text-center leading-relaxed mt-2 max-w-lg opacity-60"
              >
                {{ nextLyricsLine }}
              </div>
            </template>
          </div>
          <div v-else class="vm-center-logo-wrap relative">
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
          @song-click="openInfoForSong"
          @preview-start="previewStartFromPlayer"
          @preview-stop="stopPreview"
          @loaded="handlePlayerLoaded(player2); checkPlayers(player2)"
          @stopped="checkPlayers(player2)"
          @finished="onSongFinished"
          @fading="songFading(player2)"
          @speed="saveSpeed(player2)"
          @cover-updated="coverUpdated"
          @timeupdate="(t) => handleLyricsTimeupdate('bottom', t)"
        />
      </div>

      <div class="flex-[5] flex flex-col p-4 space-y-2 min-w-0">
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
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-black/30 p-2"
              @click="pause"
            >
              <i-material-symbols-pause class="w-10 h-10 text-white" />
            </button>

            <button
              v-else
              :disabled="!canManualPlay"
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-black/30 p-2"
              @click="play"
            >
              <i-mdi-play class="w-10 h-10 text-white" />
            </button>

            <button
              :disabled="!canManualNext"
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-black/30 p-2"
              @click="next"
            >
              <i-material-symbols-skip-next class="w-6 h-6 text-white" />
            </button>

            <div class="flex items-center">
              <a-checkbox
                v-if="
                  player1 &&
                  player2 &&
                  (player1.status === playerStatuses.Reproduciendo ||
                    player2.status === playerStatuses.Reproduciendo)
                "
                v-model:checked="autopause"
                class="text-white"
              >
                Autopausa
              </a-checkbox>
            </div>
          </div>

          <div v-if="playlistDetails.length > 0" class="flex items-center space-x-3">
            <button
              :disabled="selectedRows.length <= 0"
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-black/30 p-2"
              @click="moveFirstControlClicked($event)"
            >
              <i-ic-baseline-move-up
                class="w-6 h-6 text-white"
                :style="isAltPressed ? { transform: 'scaleY(-1)' } : null"
              />
            </button>

            <button
              :disabled="selectedRows.length <= 0"
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-black/30 p-2"
              @click="moveUp(playlistDetails, selectedRows[0])"
            >
              <i-teenyicons-up-solid class="w-6 h-6 text-white" />
            </button>

            <button
              :disabled="selectedRows.length <= 0"
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-black/30 p-2"
              @click="moveDown(playlistDetails, selectedRows[0])"
            >
              <i-teenyicons-down-solid class="w-6 h-6 text-white" />
            </button>

            <button
              :disabled="selectedRows.length <= 0"
              type="button"
              class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-black/30 text-white p-2"
              @click="remove(playlistDetails, selectedRows[0])"
            >
              <i-mdi-remove-bold class="w-6 h-6 text-white" />
            </button>
          </div>

          <div v-if="playlistDetails.length > 0" class="flex items-center space-x-3">
            <button
              :disabled="
                !player1 ||
                selectedRows.length <= 0 ||
                player1.status === playerStatuses.Reproduciendo ||
                player1.status === playerStatuses.Cambiando
              "
              type="button"
              class="flex items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-black/30 text-white p-2"
              @click="loadDeck('A')"
            >
              <i-ic-baseline-download class="w-6 h-6 deck-a-indicator" />
              <span class="inline-block p-1 leading-none deck-a-badge">A</span>
            </button>

            <button
              :disabled="
                !player2 ||
                selectedRows.length <= 0 ||
                player2.status === playerStatuses.Reproduciendo ||
                player2.status === playerStatuses.Cambiando
              "
              type="button"
              class="flex items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-black/30 text-white p-2"
              @click="loadDeck('B')"
            >
              <i-ic-baseline-download class="w-6 h-6 deck-b-indicator" />
              <span class="inline-block p-1 leading-none deck-b-badge">B</span>
            </button>
          </div>
        </div>

        <div
          v-bind="playlistContainerProps"
          class="playlist-list-container bg-gray-900 flex-1 overflow-y-auto basis-0"
        >
          <div v-bind="playlistWrapperProps">
            <table class="dark playlist-table border-collapse w-full text-sm table-fixed">
              <colgroup>
                <col style="width: 56px" />
                <col style="width: calc((100% - 88px) / 2)" />
                <col style="width: calc((100% - 88px) / 2)" />
                <col style="width: 32px" />
              </colgroup>
              <tbody>
                <tr
                  v-for="row in playlistRows"
                  :key="row.data.entryId"
                  :data-entry-id="row.data.entryId"
                  @click="selectRow($event, row.data.entryId)"
                  @mousedown.left="onPlaylistRowPressStart(row.data, $event)"
                  @mouseup.left="onPlaylistRowPressEnd()"
                  @mouseleave="onPlaylistRowPressEnd()"
                  @touchstart.stop.prevent="onPlaylistRowPressStart(row.data)"
                  @touchend.stop="onPlaylistRowPressEnd()"
                  @touchcancel.stop="onPlaylistRowPressEnd()"
                >
                  <td
                    class="playlist-index-cell text-right"
                    :class="{ 'playlist-row-selected': selectedRowsSet.has(row.data.entryId) }"
                  >
                    {{ row.index + 1 }}
                  </td>
                  <td
                    class="cursor-pointer"
                    :class="{ 'playlist-row-selected': selectedRowsSet.has(row.data.entryId) }"
                  >
                    <div class="playlist-title-cell">
                      <span class="playlist-song-name">{{ row.data.name }}</span>
                    </div>
                  </td>
                  <td
                    class="cursor-pointer playlist-artist-cell"
                    :class="{ 'playlist-row-selected': selectedRowsSet.has(row.data.entryId) }"
                  >
                    {{ row.data.Artists.map((i) => i.name).join(', ') }}
                  </td>
                  <td
                    class="text-center w-[32px]"
                    :class="{ 'playlist-row-selected': selectedRowsSet.has(row.data.entryId) }"
                  >
                    <i-mdi-headphones
                      v-if="isPlaylistEntryPreviewing(row.data)"
                      class="w-4 h-4 text-white mx-auto"
                      title="Previsualizando en audífonos"
                    />
                    <i-mdi-alert
                      v-else-if="hasRecentArtistMatch(row.data, row.index)"
                      class="w-4 h-4 text-yellow-500 mx-auto"
                      title="Artista se reprodujo recientemente"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="playlistDetails.length > 0" class="flex items-center justify-between">
          <div class="play-next-status text-xs text-white">
            <span v-if="playlistDetails.length <= 0">No hay más canciones</span>
            <span v-else-if="playlistDetails.length > 1"
              >{{ playlistDetails.length }} canciones</span
            >
            <span v-else>1 canción restante</span>
            <span v-if="playlistEtaText" class="text-lime-500">. {{ playlistEtaText }}</span>
            <span v-else>.</span>
          </div>

          <div class="flex items-center space-x-2">
            <div v-if="playlistDetails.length > 3" class="flex items-center space-x-2 mr-4">
              <input
                v-model="playlistSearchQuery"
                type="text"
                class="bg-black text-white text-xs px-2 py-1 w-40 outline-none"
                placeholder="Buscar en lista"
                @input="onPlaylistSearchInput"
              />
              <span class="text-white text-xs whitespace-nowrap">
                {{ playlistSearchResults.length > 0 ? playlistSearchIndex + 1 : 0 }}/{{
                  playlistSearchResults.length
                }}
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
            />
            <button
              v-if="false"
              :disabled="isImportingM3U"
              type="button"
              class="flex text-white text-xs items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-black/30 p-1 px-2"
              @click="openM3UPicker"
            >
              <i-mdi-file-music-outline class="w-4 h-4" />
              <span>{{ isImportingM3U ? 'Cargando...' : 'Cargar' }}</span>
            </button>
            <a-button
              :disabled="playlistDetails.length <= 1"
              size="small"
              class="playlist-quick-action"
              @click="shufflePlaylist"
            >
              <template #icon>
                <i-ic-baseline-shuffle class="w-4 h-4" />
              </template>
              Revolver
            </a-button>

            <a-button
              :disabled="playlistDetails.length <= 0"
              size="small"
              class="playlist-quick-action"
              @click="openSavePlaylistModal"
            >
              <template #icon>
                <i-mdi-content-save class="w-4 h-4" />
              </template>
              Guardar
            </a-button>

            <a-button
              :disabled="playlistDetails.length <= 0"
              size="small"
              class="playlist-quick-action"
              @click="removeAll(playlistDetails)"
            >
              <template #icon>
                <i-iconamoon-trash-fill class="w-4 h-4" />
              </template>
              Vaciar
            </a-button>
          </div>
        </div>
      </div>

      <div
        class="vm-side-nav z-50 text-sm flex flex-col space-y-10 justify-between items-center fullheight"
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
              <i-material-symbols-library-music-outline-sharp class="w-7 h-7" />
            </div>
          </div>

          <div
            :class="{ 'vm-item-selected': currentSelectedOption === options.download }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.download)"
          >
            <div class="relative">
              <i-ic-sharp-download class="w-8 h-8" />
              <span
                v-if="downloadTasksCount > 0"
                class="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[16px] text-center"
              >
                {{ downloadTasksCount }}
              </span>
            </div>
          </div>

          <div
            :class="{ 'vm-item-selected': currentSelectedOption === options.add_mp3 }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.add_mp3)"
          >
            <div>
              <i-ic-sharp-add class="w-8 h-8" />
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

          <div
            :class="{ 'vm-item-selected': currentSelectedOption === options.playlists }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.playlists)"
          >
            <div>
              <i-mdi-playlist-music class="w-7 h-7" />
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
              <i-material-symbols-artist class="w-8 h-8" />
            </div>
          </div>

          <div
            :class="{ 'vm-item-selected': currentSelectedOption === options.tags }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.tags)"
          >
            <div>
              <i-mdi-tags class="w-8 h-8" />
            </div>
          </div>

          <div
            v-if="customUpdaterActionVisible"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="openCustomUpdaterOverlay()"
          >
            <div class="relative">
              <i-ic-baseline-update class="w-8 h-8" />
              <span class="vm-side-alert-dot" />
            </div>
          </div>

          <div
            :class="{ 'vm-item-selected': currentSelectedOption === options.changelog }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.changelog)"
          >
            <div>
              <i-mdi-file-document-outline class="w-8 h-8" />
            </div>
          </div>

          <div
            :class="{ 'vm-item-selected': currentSelectedOption === options.settings }"
            class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
            @click="setOption(options.settings)"
          >
            <div>
              <i-mdi-settings class="w-8 h-8" />
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

    <div v-if="customUpdaterDevtoolsVisible" class="vm-update-devtools">
      <button
        type="button"
        class="vm-update-devtools-toggle"
        @click="customUpdaterDevtoolsOpen = !customUpdaterDevtoolsOpen"
      >
        Update preview
      </button>
      <div v-if="customUpdaterDevtoolsOpen" class="vm-update-devtools-panel">
        <div class="vm-update-devtools-title">Estados del overlay</div>
        <div class="vm-update-devtools-grid">
          <button
            v-for="preset in customUpdaterDevPresets"
            :key="preset.key"
            type="button"
            class="vm-update-devtools-chip"
            :class="{ 'is-active': customUpdaterDevPresetKey === preset.key }"
            @click="applyCustomUpdaterPreview(preset.key)"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal guardar playlist -->
    <a-modal
      v-model:open="savePlaylistModalVisible"
      title="Guardar playlist"
      :ok-text="'Guardar'"
      :cancel-text="'Cancelar'"
      @ok="savePlaylist"
      @cancel="savePlaylistModalVisible = false"
    >
      <a-input v-model:value="playlistNameToSave" placeholder="Nombre de la playlist" />
      <p v-if="savePlaylistError" class="text-red-500 text-sm mt-2">{{ savePlaylistError }}</p>
    </a-modal>
  </a-config-provider>
</template>

<script setup>
import axios from 'axios'
import { onMounted, onUnmounted, computed, ref, watch, reactive, nextTick } from 'vue'
import { useVirtualList } from '@vueuse/core'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import logoSvgMarkup from './assets/logo.svg?raw'
import appIconUrl from '../../../resources/icon.png?asset'

/* Components */
import Artists from './components/Artists.vue'
import Tags from './components/Tags.vue'
import Player from './components/Player.vue'
import Download from './components/Download.vue'
import Settings from './components/Settings.vue'
import Edit from './components/Edit.vue'
import AddMp3 from './components/AddMp3.vue'
import Wave from './components/Wave.vue'
import Multiselect from './components/Multiselect.vue'
import Changelog from './components/Changelog.vue'
import Playlists from './components/Playlists.vue'

let options = {
  library: 10,
  download: 20,
  history: 22,
  playlists: 25,
  downloadDetails: 28,
  tags: 30,
  settings: 40,
  artists: 50,
  edit: 60,
  add_mp3: 65,
  wave: 70,
  changelog: 80
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
const COLOR_SCHEMA_DEFAULT = 'sunset'
const COLOR_SCHEMA_VALUES = [
  'monochrome',
  'sunset',
  'aurora',
  'orquidea',
  'tormenta_cobre',
  'bosque',
  'linen',
  'coral',
  'nocturno',
  'ocean',
  'oceano'
]
const COLOR_SCHEMA_TRANSITION_MS = 1000
let colorSchemaTransitionTimer = null
let colorSchemaTransitionRaf = null
const SONG_HISTORY_STORAGE_KEY = 'vmusic_song_history'
const CENTER_VISUALIZER_STORAGE_KEY = 'vmusic_center_visualizer'
const antTheme = {
  token: {
    colorPrimary: 'var(--vm-ant-primary)',
    colorInfo: 'var(--vm-ant-primary)',
    colorLink: 'var(--vm-ant-primary)',
    colorPrimaryHover: 'color-mix(in srgb, var(--vm-ant-primary) 84%, black 16%)',
    colorPrimaryActive: 'color-mix(in srgb, var(--vm-ant-primary) 72%, black 28%)',
    colorPrimaryBorder: 'var(--vm-ant-primary)',
    controlOutline: 'color-mix(in srgb, var(--vm-ant-primary) 28%, transparent)',
    controlItemBgActive: 'color-mix(in srgb, var(--vm-ant-primary) 14%, #ffffff 86%)'
  },
  components: {
    Select: {
      optionActiveBg: 'color-mix(in srgb, var(--vm-ant-primary) 9%, #ffffff 91%)',
      optionSelectedBg: 'color-mix(in srgb, var(--vm-ant-primary) 14%, #ffffff 86%)',
      optionSelectedColor: '#0f172a'
    },
    Table: {
      rowHoverBg: 'color-mix(in srgb, var(--vm-ant-primary) 9%, #ffffff 91%)',
      rowSelectedBg: 'color-mix(in srgb, var(--vm-ant-primary) 14%, #ffffff 86%)',
      rowSelectedHoverBg: 'color-mix(in srgb, var(--vm-ant-primary) 16%, #ffffff 84%)'
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
  if (schema === 'default') {
    return 'sunset'
  }
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
    window.dispatchEvent(
      new CustomEvent('vmusic-color-schema-changed', {
        detail: { schema: normalized }
      })
    )
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
const artistFilterQuery = ref('')
const tagFilterQuery = ref('')
const artistFilterMode = ref('any')
const tagFilterMode = ref('any')
const selectedSongs = ref([])
const filterQuery = ref('')
const deletedSongs = ref([])
const debouncedFilterQuery = ref('')
let filterQueryDebounceTimer = null
const isLoadingLibrary = ref(true)
const autopause = ref(false)
const isAltPressed = ref(false)
const isLeftAltPressed = ref(false)
const isLeftShiftPressed = ref(false)
const isLeftMetaPressed = ref(false)
const ESC_DOUBLE_PRESS_WINDOW_MS = 1000
let lastEscapePressAt = 0
const previewAudio = ref(null)
const previewSongId = ref(null)
const previewStatus = ref('idle')
const isPreviewLoading = ref(false)
const previewSinkId = ref(null)
const previewOutputs = ref([])
const previewPlaylistEntryId = ref(null)
const deckSinkId = ref(null)
const playbackStateBeforePowerInterruption = ref({ top: false, bottom: false })
const waveEditorPreviewActive = ref(false)
const PREVIEW_DECK_DUCK_MULTIPLIER = 0.2
const hasStoredSettings = Boolean(localStorage.getItem('vmusic_settings'))
const savedSettingsRef = JSON.parse(localStorage.getItem('vmusic_settings')) || {}
const normalizedHistoryLimit = normalizeHistoryLimit(savedSettingsRef.historyLimit)
const normalizedRowsPerPage = normalizeRowsPerPage(savedSettingsRef.rowsPerPage, 24)
const normalizedRowsPerPageFs = normalizeRowsPerPage(
  savedSettingsRef.rowsPerPageFs,
  normalizedRowsPerPage
)
const normalizedShowAdvancedFunctions = Boolean(savedSettingsRef.showAdvancedFunctions)
const normalizedAutoUpdateCovers = Boolean(savedSettingsRef.autoUpdateCovers)
previewSinkId.value = savedSettingsRef.previewSinkId || null
deckSinkId.value = savedSettingsRef.deckSinkId || null
const excludedTags = ref(savedSettingsRef.excludeTags || [])
const colorSchema = ref(applyColorSchema(savedSettingsRef.colorSchema))
const showAdvancedFunctions = ref(normalizedShowAdvancedFunctions)
if (
  hasStoredSettings &&
  (savedSettingsRef.colorSchema !== colorSchema.value ||
    savedSettingsRef.historyLimit !== normalizedHistoryLimit ||
    savedSettingsRef.rowsPerPage !== normalizedRowsPerPage ||
    savedSettingsRef.rowsPerPageFs !== normalizedRowsPerPageFs ||
    savedSettingsRef.showAdvancedFunctions !== normalizedShowAdvancedFunctions ||
    savedSettingsRef.autoUpdateCovers !== normalizedAutoUpdateCovers)
) {
  localStorage.setItem(
    'vmusic_settings',
    JSON.stringify({
      ...savedSettingsRef,
      colorSchema: colorSchema.value,
      historyLimit: normalizedHistoryLimit,
      rowsPerPage: normalizedRowsPerPage,
      rowsPerPageFs: normalizedRowsPerPageFs,
      showAdvancedFunctions: normalizedShowAdvancedFunctions,
      autoUpdateCovers: normalizedAutoUpdateCovers
    })
  )
}
const downloadTasksCount = ref(0)
const DOWNLOAD_TASKS_STORAGE_KEY = 'vmusic_download_tasks'
const DOWNLOAD_TASK_TIMEOUT_MS = 5 * 60 * 1000
const SONG_NOTES_STORAGE_KEY = 'vmusic_song_notes'
const isLocalRenderer =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
const isDev = import.meta.env.DEV || isLocalRenderer
const customUpdaterState = ref({
  status: 'idle',
  version: '',
  message: '',
  downloaded: false,
  supported: false
})
const songNotesMap = ref({})
const customUpdaterOverlayOpen = ref(false)
const customUpdaterInitialStateHandled = ref(false)
const customUpdaterDevtoolsOpen = ref(false)
const customUpdaterDevPresetKey = ref('')
const isMacPlatform =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')
const customUpdaterDevPresets = [
  {
    key: 'checking',
    label: 'Buscando',
    state: {
      status: 'checking',
      version: 'v2.4.0',
      message: 'Estamos consultando la última versión disponible para preparar la actualización.'
    },
    progress: 12
  },
  {
    key: 'available',
    label: 'Disponible',
    state: {
      status: 'available',
      version: 'v2.4.0',
      message: 'La actualización ya fue encontrada y está lista para descargarse en segundo plano.'
    },
    progress: 28
  },
  {
    key: 'downloading',
    label: 'Descargando',
    state: {
      status: 'downloading',
      version: 'v2.4.0',
      message:
        'Descargando el paquete seguro. La app seguirá preparando el reemplazo automáticamente.'
    },
    progress: 68
  },
  {
    key: 'downloaded',
    label: 'Lista',
    state: {
      status: 'downloaded',
      version: 'v2.4.0',
      message: 'Todo está listo. Solo falta cerrar y aplicar la nueva versión.'
    },
    progress: 100
  },
  {
    key: 'installing',
    label: 'Instalando',
    state: {
      status: 'installing',
      version: 'v2.4.0',
      message: 'Reemplazando la aplicación actual con la nueva versión. Esto toma solo un momento.'
    },
    progress: 100
  },
  {
    key: 'error',
    label: 'Error',
    state: {
      status: 'error',
      version: 'v2.4.0',
      message: 'No pudimos terminar la actualización. Revisa permisos o vuelve a intentarlo.'
    },
    progress: 100
  }
]
const customUpdaterDevPreset = computed(
  () =>
    customUpdaterDevPresets.find((preset) => preset.key === customUpdaterDevPresetKey.value) || null
)
const customUpdaterPreviewActive = computed(() => isDev && Boolean(customUpdaterDevPreset.value))
const customUpdaterDisplayState = computed(() => {
  if (!customUpdaterPreviewActive.value) {
    return customUpdaterState.value
  }

  return {
    ...customUpdaterState.value,
    ...customUpdaterDevPreset.value.state,
    downloaded: customUpdaterDevPreset.value.state.status === 'downloaded'
  }
})
const customUpdaterListener = (_event, payload) => {
  customUpdaterState.value = {
    ...customUpdaterState.value,
    ...(payload || {})
  }
}

function loadSongNotesMap() {
  try {
    const stored = localStorage.getItem(SONG_NOTES_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : {}
    songNotesMap.value = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    songNotesMap.value = {}
  }
}

function getSongNote(record) {
  const ytid = String(record?.ytid || '').trim()
  if (!ytid) return ''

  return String(songNotesMap.value[ytid] || '').trim()
}

function getStoredCoverMap() {
  try {
    const stored = localStorage.getItem('vmusic_cover_map')
    const parsed = stored ? JSON.parse(stored) : {}

    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function getSongCoverUrl(song, storedCoverMap = null) {
  if (!song) return ''

  const directCover =
    song.songImage || song.coverUrl || song.cover || song.image || song.artwork || ''
  if (directCover) return directCover

  const ytid = String(song.ytid || '').trim()
  if (!ytid) return ''

  const coverMap = storedCoverMap || getStoredCoverMap()

  return String(coverMap[ytid] || '')
}

function songHasCover(song, storedCoverMap = null) {
  return Boolean(getSongCoverUrl(song, storedCoverMap))
}

function onSongNotesChanged() {
  loadSongNotesMap()
}
let systemPowerResumeTimerId = null

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
const PLAYLIST_ROW_HEIGHT = 26
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
const lastActiveDeckPosition = ref(null)
let initialDeckBLoadTimer = null
let logoAnimationIntervalId = null
const isWindowFullscreen = ref(false)
const mediaSessionActions = ['play', 'pause', 'nexttrack', 'previoustrack', 'stop']
const mediaKeyCodes = new Set([
  'MediaPlayPause',
  'MediaPlay',
  'MediaPause',
  'MediaTrackNext',
  'MediaTrackPrevious',
  'MediaStop'
])
const KEYBOARD_SEEK_SECONDS = 5
const KEYBOARD_SPEED_STEP = 1
const CENTER_VISUALIZER_BAR_COUNT = 8
const centerVisualizerEnabled = ref(true)
const centerVisualizerBarHeights = ref(
  Array.from({ length: CENTER_VISUALIZER_BAR_COUNT }, () => 0.16)
)
const centerVisualizerDebugRms = ref(0)
let centerVisualizerAudioContext = null
let centerVisualizerAnalyser = null
let centerVisualizerSourceNode = null
let centerVisualizerBoundMedia = null
let centerVisualizerFrameId = null
let centerVisualizerDataBuffer = null
let centerVisualizerRetryMedia = null
let centerVisualizerRetryHandler = null
let centerVisualizerRetryTimeoutId = null
let centerVisualizerRetryAttempt = 0
const CENTER_VISUALIZER_RETRY_DELAY_MS = 180
const CENTER_VISUALIZER_RETRY_MAX_ATTEMPTS = 24

function normalizeOutputDeviceId(deviceId) {
  return deviceId && deviceId !== 'default' ? deviceId : 'default'
}

function shouldDuckDeckPlayersForPreview() {
  const isStandardPreviewActive =
    previewStatus.value === 'loading' || previewStatus.value === 'playing'
  const sameOutputDevice =
    normalizeOutputDeviceId(previewSinkId.value) === normalizeOutputDeviceId(deckSinkId.value)

  return sameOutputDevice && (isStandardPreviewActive || waveEditorPreviewActive.value)
}

function syncPreviewDeckDucking() {
  const shouldDuck = shouldDuckDeckPlayersForPreview()

  if (player1.value?.setPreviewDucking) {
    player1.value.setPreviewDucking(shouldDuck, PREVIEW_DECK_DUCK_MULTIPLIER)
  }
  if (player2.value?.setPreviewDucking) {
    player2.value.setPreviewDucking(shouldDuck, PREVIEW_DECK_DUCK_MULTIPLIER)
  }
}

watch(
  [previewStatus, previewSinkId, deckSinkId, waveEditorPreviewActive, player1, player2],
  () => {
    syncPreviewDeckDucking()
  },
  { immediate: true }
)

watch(showAdvancedFunctions, (enabled) => {
  if (enabled) return

  artistFilterQuery.value = ''
  tagFilterQuery.value = ''
})

function onWavePreviewPlayState(isPlaying) {
  waveEditorPreviewActive.value = Boolean(isPlaying)
}

// Multiselects
const artistMultiSelect = ref(null)
const tagMultiSelect = ref(null)
const pageSizeRef = ref(24)
const libraryState = ref({
  artists: [],
  tags: [],
  page: 1,
  artistMode: 'any',
  tagMode: 'any'
})

const downloadSelectedArtist = ref(null)
const generateEntryId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`
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

const playlistSource = computed(() => playlistDetails.value.slice())

const {
  list: playlistVirtualRows,
  containerProps: playlistContainerProps,
  wrapperProps: playlistWrapperProps,
  scrollTo: scrollPlaylistTo
} = useVirtualList(playlistSource, {
  itemHeight: PLAYLIST_ROW_HEIGHT,
  overscan: 14
})

const playlistRows = computed(() => playlistVirtualRows.value)
const repeatedArtistWarningSet = computed(() => {
  const set = new Set()
  for (let index = 1; index < playlistDetails.value.length; index++) {
    const song = playlistDetails.value[index]
    const prev = playlistDetails.value[index - 1]
    if (!song || !prev || !Array.isArray(song.Artists) || !Array.isArray(prev.Artists)) continue
    const prevIds = new Set(prev.Artists.map((artist) => artist.id))
    if (song.Artists.some((artist) => prevIds.has(artist.id))) {
      set.add(song.entryId)
    }
  }

  return set
})

const filteredSongs2 = computed(() => {
  const normalizedQuery = removeAccents((debouncedFilterQuery.value || '').toLowerCase())

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
    const normalizedName = item.nameNorm || removeAccents((item.name || '').toLowerCase())
    const normalizedArtists =
      item.artistsNorm ||
      removeAccents(
        (item.Artists || [])
          .map((a) => a.name)
          .join(' ')
          .toLowerCase()
      )

    return normalizedName.includes(normalizedQuery) || normalizedArtists.includes(normalizedQuery)
  })
})

const deletedSongsSet = computed(() => new Set(deletedSongs.value))
const selectedRowsSet = computed(() => new Set(selectedRows.value))

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
      title: 'Rep',
      dataIndex: 'playCount',
      width: 120,
      align: 'center',
      sorter: {
        compare: (a, b) => (a.playCount || 0) - (b.playCount || 0)
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

    const foundCol = cols.find(
      (item) => item.dataIndex && item.dataIndex.trim() === sortConfig.column.trim()
    )
    if (foundCol) {
      foundCol.sortOrder = sortConfig.order
    }
  }

  return cols
})

const historyColumns = computed(() => [
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
])

const recentSongHistory = computed(() => {
  const limit = normalizeHistoryLimit(savedSettingsRef.historyLimit)

  return [...songHistory.value]
    .sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0))
    .slice(0, limit)
})

const addButtonDisabled = computed(() => {
  const player1Status = player1.value?.status
  const player2Status = player2.value?.status

  return (
    selectedSongs.value.length <= 0 ||
    player1Status === playerStatuses.Cambiando ||
    player2Status === playerStatuses.Cambiando
  )
})

const addRandomButtonDisabled = computed(() => {
  const player1Status = player1.value?.status
  const player2Status = player2.value?.status
  const selectedCount = selectedSongs.value.length
  const candidateCount = selectedCount > 0 ? selectedCount : filteredSongs2.value.length

  return (
    candidateCount <= 1 ||
    player1Status === playerStatuses.Cambiando ||
    player2Status === playerStatuses.Cambiando
  )
})

const isDeckAInitialPreprocessBlockingPlayback = computed(() => {
  return Boolean(
    player1.value?.isInitialSpeedPreprocessPending || player1.value?.isPreprocessingSpeed
  )
})

const isNextDeckSpeedPreprocessBlocking = computed(() => {
  if (!player1.value || !player2.value) return false

  if (player1.value.status === playerStatuses.Reproduciendo) {
    return Boolean(
      player2.value?.isInitialSpeedPreprocessPending || player2.value?.isPreprocessingSpeed
    )
  }

  if (player2.value.status === playerStatuses.Reproduciendo) {
    return Boolean(
      player1.value?.isInitialSpeedPreprocessPending || player1.value?.isPreprocessingSpeed
    )
  }

  return false
})

function isPlayerReady(playerRef) {
  return playerRef?.status === playerStatuses.Listo || playerRef?.status === playerStatuses.Pausado
}

function isPlayerPlaying(playerRef) {
  return playerRef?.status === playerStatuses.Reproduciendo
}

function getPlayerByPosition(position) {
  if (position === 'top') return player1.value
  if (position === 'bottom') return player2.value

  return null
}

function getReadyPlayerForPlayback() {
  if (!player1.value || !player2.value) return null
  const preferredPlayer = getPlayerByPosition(lastActiveDeckPosition.value)

  if (isPlayerReady(preferredPlayer)) {
    return preferredPlayer
  }

  if (isFirstPlay.value) {
    return isPlayerReady(player1.value) ? player1.value : null
  }

  if (isPlayerReady(player1.value)) return player1.value
  if (isPlayerReady(player2.value)) return player2.value

  return null
}

function getActivePlayerForManualNext() {
  if (!player1.value || !player2.value) return null
  const preferredPlayer = getPlayerByPosition(lastActiveDeckPosition.value)

  if (isPlayerPlaying(player1.value) && isPlayerReady(player2.value)) return player1.value
  if (isPlayerPlaying(player2.value) && isPlayerReady(player1.value)) return player2.value
  if (isPlayerPlaying(preferredPlayer)) return preferredPlayer

  return null
}

const canManualPlay = computed(() => {
  return Boolean(getReadyPlayerForPlayback())
})

const canManualNext = computed(() => {
  if (isDeckAInitialPreprocessBlockingPlayback.value || isNextDeckSpeedPreprocessBlocking.value)
    return false

  return Boolean(getActivePlayerForManualNext())
})

const customUpdaterVisible = computed(() => {
  if (!isMacPlatform && !customUpdaterPreviewActive.value) return false

  return ['checking', 'available', 'downloading', 'downloaded', 'installing', 'error'].includes(
    customUpdaterDisplayState.value.status
  )
})

const customUpdaterBlocking = computed(() => {
  if (!isMacPlatform && !customUpdaterPreviewActive.value) return false

  return (
    customUpdaterOverlayOpen.value &&
    ['checking', 'available', 'downloading', 'downloaded', 'installing', 'error'].includes(
      customUpdaterDisplayState.value.status
    )
  )
})

const customUpdaterActionVisible = computed(() => {
  if (!isMacPlatform && !customUpdaterPreviewActive.value) return false

  return ['available', 'downloading', 'downloaded', 'installing'].includes(
    customUpdaterDisplayState.value.status
  )
})

const customUpdaterDevtoolsVisible = computed(() => isDev)

const customUpdaterStatusLabel = computed(() => {
  switch (customUpdaterDisplayState.value.status) {
    case 'checking':
      return 'Buscando'
    case 'available':
      return 'Disponible'
    case 'downloading':
      return 'Descargando'
    case 'downloaded':
      return 'Lista'
    case 'installing':
      return 'Instalando'
    case 'error':
      return 'Error'
    default:
      return 'Actualización'
  }
})

const customUpdaterStatusDetail = computed(() => {
  switch (customUpdaterDisplayState.value.status) {
    case 'checking':
      return 'Validando nueva versión'
    case 'available':
      return 'Paquete detectado'
    case 'downloading':
      return 'Transferencia en progreso'
    case 'downloaded':
      return 'Esperando confirmación'
    case 'installing':
      return 'Aplicando reemplazo'
    case 'error':
      return 'Intervención requerida'
    default:
      return 'Sin actividad'
  }
})

const customUpdaterProgressValue = computed(() => {
  if (customUpdaterPreviewActive.value) {
    return customUpdaterDevPreset.value?.progress || 0
  }

  switch (customUpdaterDisplayState.value.status) {
    case 'checking':
      return 12
    case 'available':
      return 26
    case 'downloading':
      return 72
    case 'downloaded':
    case 'installing':
    case 'error':
      return 100
    default:
      return 0
  }
})

const customUpdaterProgressVisible = computed(() =>
  ['checking', 'available', 'downloading', 'downloaded', 'installing'].includes(
    customUpdaterDisplayState.value.status
  )
)

const customUpdaterProgressCaption = computed(() => {
  if (customUpdaterDisplayState.value.status === 'downloaded') {
    return 'Paquete descargado y listo para instalar'
  }
  if (customUpdaterDisplayState.value.status === 'installing') {
    return 'Aplicando actualización'
  }

  return `${customUpdaterProgressValue.value}% del flujo completado`
})

const customUpdaterTitle = computed(() => {
  switch (customUpdaterDisplayState.value.status) {
    case 'checking':
      return 'Buscando actualización'
    case 'available':
      return `Nueva versión ${customUpdaterDisplayState.value.version || ''}`.trim()
    case 'downloading':
      return `Descargando ${customUpdaterDisplayState.value.version || 'actualización'}`
    case 'downloaded':
      return `Actualización lista ${customUpdaterDisplayState.value.version || ''}`.trim()
    case 'installing':
      return 'Instalando actualización'
    case 'error':
      return 'No se pudo actualizar'
    default:
      return 'Actualización'
  }
})

const customUpdaterMessage = computed(() => {
  return customUpdaterDisplayState.value.message || 'Actualización personal para macOS.'
})

function shouldAutoOpenLibraryAtStartup(status) {
  return !['checking', 'available', 'downloading', 'downloaded', 'installing', 'error'].includes(
    String(status || '')
  )
}

async function checkCustomUpdater() {
  if (!window.electron2?.checkCustomUpdater) return
  const nextState = await window.electron2.checkCustomUpdater()
  customUpdaterState.value = {
    ...customUpdaterState.value,
    ...(nextState || {})
  }
}

function openCustomUpdaterOverlay() {
  if (!customUpdaterActionVisible.value && customUpdaterDisplayState.value.status !== 'error')
    return
  customUpdaterOverlayOpen.value = true
}

function applyCustomUpdaterPreview(key) {
  if (!isDev) return

  customUpdaterDevPresetKey.value = key
  customUpdaterOverlayOpen.value = true
}

function clearCustomUpdaterPreview() {
  if (!isDev) return

  customUpdaterDevPresetKey.value = ''
  customUpdaterOverlayOpen.value = false
}

function onCustomUpdaterDevShortcut(event) {
  if (!isDev) return
  if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return
  if (String(event.key || '').toLowerCase() !== 'u') return

  event.preventDefault()
  customUpdaterDevtoolsOpen.value = !customUpdaterDevtoolsOpen.value

  if (customUpdaterDevtoolsOpen.value && !customUpdaterDevPresetKey.value) {
    applyCustomUpdaterPreview('checking')
  }
}

watch(
  () => customUpdaterDisplayState.value.status,
  (status) => {
    if (
      !customUpdaterInitialStateHandled.value &&
      ['available', 'downloading', 'downloaded', 'installing', 'error'].includes(status)
    ) {
      customUpdaterOverlayOpen.value = true
      customUpdaterInitialStateHandled.value = true

      return
    }

    if (!customUpdaterInitialStateHandled.value && ['up-to-date', 'idle'].includes(status)) {
      customUpdaterInitialStateHandled.value = true
    }

    if (['idle', 'up-to-date'].includes(status)) {
      customUpdaterOverlayOpen.value = false
    }
  }
)

async function installCustomUpdaterNow() {
  if (!window.electron2?.installCustomUpdaterNow) return
  await window.electron2.installCustomUpdaterNow()
}

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
    colorSchema: COLOR_SCHEMA_DEFAULT,
    showAdvancedFunctions: false,
    autoUpdateCovers: false
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
    artistsJoined: Array.isArray(song.Artists)
      ? song.Artists.map((artist) => artist.name).join(', ')
      : '',
    composersJoined: Array.isArray(song.Composers)
      ? song.Composers.map((composer) => composer.name).join(', ')
      : ''
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
        historyId:
          item.historyId ||
          `${item.id}-${item.playedAt || Date.now()}-${Math.random().toString(16).slice(2)}`,
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
    historyId: `${normalized.id}-${playedAt}-${Math.random().toString(16).slice(2)}`,
    playedAt,
    playedAtText: formatHistoryPlayedAt(playedAt)
  }
  const limit = normalizeHistoryLimit(
    JSON.parse(localStorage.getItem('vmusic_settings'))?.historyLimit
  )
  songHistory.value = [entry, ...songHistory.value]
    .sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0))
    .slice(0, limit)
  saveSongHistory()
}

loadSongHistory()

onMounted(() => {
  // filterSongs()
  logoAnimationIntervalId = setInterval(function () {
    const logo = document.getElementById('logo')
    if (!logo) return

    logo.classList.add('jello-horizontal')
    setTimeout(function () {
      logo.classList.remove('jello-horizontal')
    }, 1000)
  }, 10000)
})

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
        const updatedAt =
          typeof task.updatedAt === 'number'
            ? task.updatedAt
            : typeof task.createdAt === 'number'
              ? task.createdAt
              : 0
        if (!updatedAt) return false

        return now - updatedAt <= DOWNLOAD_TASK_TIMEOUT_MS
      })
      if (
        filtered.length !==
        parsed.filter((task) => task.status !== 'done' && task.status !== 'error').length
      ) {
        localStorage.setItem(
          DOWNLOAD_TASKS_STORAGE_KEY,
          JSON.stringify([
            ...parsed.filter((task) => task.status === 'done' || task.status === 'error'),
            ...filtered
          ])
        )
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
  loadSongNotesMap()
  refreshDownloadCount()
  if (window.electron2?.getCustomUpdaterState) {
    window.electron2
      .getCustomUpdaterState()
      .then((state) => {
        customUpdaterState.value = {
          ...customUpdaterState.value,
          ...(state || {})
        }
        if (shouldAutoOpenLibraryAtStartup(customUpdaterState.value.status)) {
          setOption(options.library)
        }
      })
      .catch(() => {
        setOption(options.library)
      })
  } else {
    setOption(options.library)
  }
  window.electron2?.onCustomUpdaterState?.(customUpdaterListener)
  setupMediaSessionHandlers()
  updateMediaSessionState()
  updateMediaSessionMetadata()
  preparePreviewOutput()
    .then(() => initializePreferredOutputDevices())
    .catch((error) => {
      console.warn('No se pudieron inicializar los dispositivos de salida', error)
    })
  syncWindowDisplayMode().finally(() => {
    pageSizeRef.value = getRowsPerPageByMode()
  })
  window.electron2?.onSystemPowerEvent?.(onSystemPowerEvent)
  window.addEventListener('keydown', onHardwareMediaKey)
  window.addEventListener('keydown', onKeyboardSeekKey, true)
  window.addEventListener('keydown', onModifierKeyDown, true)
  window.addEventListener('keydown', onCustomUpdaterDevShortcut)
  window.addEventListener('keyup', onModifierKeyUp)
  window.addEventListener('blur', onWindowBlurResetModifiers)
  window.addEventListener('vmusic-song-notes-changed', onSongNotesChanged)
  window.addEventListener('storage', onDownloadTasksStorageChanged)
  window.addEventListener('vmusic-download-tasks-changed', onDownloadTasksStorageChanged)
})

onUnmounted(() => {
  clearMediaSessionHandlers()
  if (filterQueryDebounceTimer) {
    clearTimeout(filterQueryDebounceTimer)
    filterQueryDebounceTimer = null
  }
  if (logoAnimationIntervalId) {
    clearInterval(logoAnimationIntervalId)
    logoAnimationIntervalId = null
  }
  window.electron2?.offCustomUpdaterState?.(customUpdaterListener)
  window.electron2?.offSystemPowerEvent?.(onSystemPowerEvent)
  window.removeEventListener('keydown', onHardwareMediaKey)
  window.removeEventListener('keydown', onKeyboardSeekKey, true)
  window.removeEventListener('keydown', onModifierKeyDown, true)
  window.removeEventListener('keydown', onCustomUpdaterDevShortcut)
  window.removeEventListener('keyup', onModifierKeyUp)
  window.removeEventListener('blur', onWindowBlurResetModifiers)
  window.removeEventListener('vmusic-song-notes-changed', onSongNotesChanged)
  window.removeEventListener('storage', onDownloadTasksStorageChanged)
  window.removeEventListener('vmusic-download-tasks-changed', onDownloadTasksStorageChanged)
  stopCenterVisualizerAnalysis()
  if (systemPowerResumeTimerId) {
    clearTimeout(systemPowerResumeTimerId)
    systemPowerResumeTimerId = null
  }
  if (centerVisualizerAudioContext && typeof centerVisualizerAudioContext.close === 'function') {
    centerVisualizerAudioContext.close()
    centerVisualizerAudioContext = null
  }
})

function onDownloadTasksStorageChanged(event) {
  if (event?.type === 'storage' && event.key && event.key !== DOWNLOAD_TASKS_STORAGE_KEY) return
  refreshDownloadCount()
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

watch(
  filterQuery,
  (value) => {
    if (filterQueryDebounceTimer) {
      clearTimeout(filterQueryDebounceTimer)
      filterQueryDebounceTimer = null
    }

    filterQueryDebounceTimer = setTimeout(() => {
      debouncedFilterQuery.value = value || ''
      filterQueryDebounceTimer = null
    }, 160)
  },
  { immediate: true }
)

watch(recentSongHistory, (rows) => {
  const validIds = new Set(rows.map((row) => row.historyId))
  historySelectedRows.value = historySelectedRows.value.filter((key) => validIds.has(key))
})

watch(
  () => [
    player1.value?.status,
    player2.value?.status,
    player1.value?.songFull?.id,
    player2.value?.songFull?.id,
    player1.value?.songFull?.name,
    player2.value?.songFull?.name
  ],
  () => {
    updateMediaSessionState()
    updateMediaSessionMetadata()
  }
)

watch(
  () => [player1.value?.status, player2.value?.status],
  () => {
    if (
      player1.value?.status === playerStatuses.Reproduciendo ||
      player1.value?.status === playerStatuses.Cambiando ||
      player1.value?.status === playerStatuses.Nivelando
    ) {
      rememberActiveDeck(player1.value)

      return
    }

    if (
      player2.value?.status === playerStatuses.Reproduciendo ||
      player2.value?.status === playerStatuses.Cambiando ||
      player2.value?.status === playerStatuses.Nivelando
    ) {
      rememberActiveDeck(player2.value)
    }
  },
  { immediate: true }
)

watch(centerVisualizerEnabled, (enabled) => {
  localStorage.setItem(CENTER_VISUALIZER_STORAGE_KEY, enabled ? '1' : '0')
  if (enabled) {
    ensureCenterVisualizerAnalysis()
  } else {
    stopCenterVisualizerAnalysis()
  }
})

const removeAccents = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

function onSearchBlur(searchValue) {
  saveLibraryView()
}

const state = reactive({
  selectedRowKeys: []
})

function formatMeridiemLabel(time) {
  return time.replace('AM', 'A.M.').replace('PM', 'P.M.')
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

function buildOutputOptions(outputs) {
  return [
    { label: 'Predeterminada (sistema)', value: 'default' },
    ...(Array.isArray(outputs) ? outputs : []).map((device) => ({
      label: device.label || 'Salida predeterminada',
      value: device.deviceId
    }))
  ]
}

function pickPreferredOutputDevice(outputs, preferredId = null) {
  if (!Array.isArray(outputs) || outputs.length === 0) return null

  const normalizedPreferredId = preferredId && preferredId !== 'default' ? preferredId : null
  if (normalizedPreferredId) {
    const remembered = outputs.find((device) => device.deviceId === normalizedPreferredId)
    if (remembered) {
      return remembered.deviceId
    }
  }

  const builtInDevice = outputs.find((device) =>
    String(device.label || '')
      .toLowerCase()
      .includes('built-in')
  )
  if (builtInDevice) {
    return builtInDevice.deviceId
  }

  return outputs[0]?.deviceId || null
}

function persistResolvedOutputSettings(nextValues = {}) {
  const currentSettings = JSON.parse(localStorage.getItem('vmusic_settings')) || {}
  localStorage.setItem(
    'vmusic_settings',
    JSON.stringify({
      ...currentSettings,
      ...nextValues
    })
  )
}

function applyDeckSinkToPlayers() {
  if (player1.value?.setSinkId && deckSinkId.value) {
    player1.value.setSinkId(deckSinkId.value)
  }
  if (player2.value?.setSinkId && deckSinkId.value) {
    player2.value.setSinkId(deckSinkId.value)
  }
}

async function loadPreviewOutputs() {
  const outputs = await requestOutputDevices()
  previewOutputs.value = buildOutputOptions(outputs)

  return outputs
}

async function resolvePreferredOutputDevices() {
  const outputs = await loadPreviewOutputs()
  const resolvedPreviewSinkId = pickPreferredOutputDevice(outputs, previewSinkId.value)
  const resolvedDeckSinkId = pickPreferredOutputDevice(outputs, deckSinkId.value)

  previewSinkId.value = resolvedPreviewSinkId
  deckSinkId.value = resolvedDeckSinkId
  persistResolvedOutputSettings({
    previewSinkId: resolvedPreviewSinkId,
    deckSinkId: resolvedDeckSinkId
  })

  return {
    previewSinkId: resolvedPreviewSinkId,
    deckSinkId: resolvedDeckSinkId
  }
}

async function initializePreferredOutputDevices() {
  const resolved = await resolvePreferredOutputDevices()
  applyDeckSinkToPlayers()

  if (
    previewAudio.value &&
    typeof previewAudio.value.setSinkId === 'function' &&
    resolved.previewSinkId
  ) {
    try {
      await previewAudio.value.setSinkId(resolved.previewSinkId)
    } catch (error) {
      console.warn('No se pudo aplicar la salida de preview inicial', error)
    }
  }

  return resolved
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

  if (
    previewAudio.value &&
    typeof previewAudio.value.setSinkId === 'function' &&
    previewSinkId.value
  ) {
    try {
      await previewAudio.value.setSinkId(previewSinkId.value)
    } catch (error) {
      console.warn('No se pudo cambiar la salida de preview', error)
      if (isMissingAudioDeviceError(error)) {
        previewSinkId.value = null

        return
      }
      alert('No se pudo cambiar la salida de previsualización.')
    }
  }
}

function isMissingAudioDeviceError(error) {
  const name = String(error?.name || '')
  const message = String(error?.message || '')

  return name === 'NotFoundError' || message.toLowerCase().includes('requested device not found')
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
        if (isMissingAudioDeviceError(error)) {
          previewSinkId.value = null
        }
      }
    }

    previewSongId.value = song.id
    previewPlaylistEntryId.value = playlistEntryId
    previewStatus.value = 'loading'
    const mediaUrl = await window.electron2.getMediaUrl({
      folder: song.folder,
      ytid: song.ytid
    })
    audio.src = mediaUrl
    const startAt = typeof song.start === 'number' ? song.start : 0
    if (startAt > 0) {
      const seekToStart = () => {
        const maxStart = Number.isFinite(audio.duration)
          ? Math.max(0, audio.duration - 0.01)
          : startAt
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
    const name = String(error?.name || '')
    const message = String(error?.message || '')
    const isAbort = name === 'AbortError' || message.toLowerCase().includes('aborted')
    if (isAbort) {
      resetPreviewState()

      return
    }
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

function syncPlaylistStateFromDetails() {
  playlist.value = playlistDetails.value.map((item) => item.id)
}

function remove(array, element) {
  const index = array.findIndex((item) => item.entryId === element)
  if (index === -1) return

  array.splice(index, 1)
  syncPlaylistStateFromDetails()

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
  syncPlaylistStateFromDetails()
}

function moveFirst(array, element) {
  const index = array.findIndex((item) => item.entryId === element)
  if (index === -1) return

  const [found] = array.splice(index, 1)
  array.unshift(found)
  syncPlaylistStateFromDetails()
}

function moveLast(array, element) {
  const index = array.findIndex((item) => item.entryId === element)
  if (index === -1) return

  const [found] = array.splice(index, 1)
  array.push(found)
  syncPlaylistStateFromDetails()
}

function moveFirstControlClicked(event) {
  if (selectedRows.value.length <= 0) return
  if (event?.altKey || isAltPressed.value) {
    moveLast(playlistDetails.value, selectedRows.value[0])

    return
  }
  moveFirst(playlistDetails.value, selectedRows.value[0])
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
  debouncedFilterQuery.value = ''
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
  } else if (libraryState.value?.page) {
    p = libraryState.value.page
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
    artistMode: artistFilterMode.value,
    tagMode: tagFilterMode.value,
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
    if (!libraryState.value.artistMode) {
      libraryState.value.artistMode = 'any'
    }
    if (!libraryState.value.tagMode) {
      libraryState.value.tagMode = 'any'
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
        selectedArtists.value = artists.value.map((a) => a.id)
      }
    }

    artistFilterMode.value = libraryState.value.artistMode === 'all' ? 'all' : 'any'
    tagFilterMode.value = libraryState.value.tagMode === 'all' ? 'all' : 'any'

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

function toArrayPayload(payload) {
  const fromIndexedObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const keys = Object.keys(value)
    if (keys.length === 0) return []
    if (!keys.every((key) => /^\d+$/.test(key))) return null

    return keys
      .map((key) => Number(key))
      .sort((a, b) => a - b)
      .map((index) => value[String(index)])
  }

  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  const indexedData = fromIndexedObject(payload?.data)
  if (indexedData) return indexedData
  const indexedPayload = fromIndexedObject(payload)
  if (indexedPayload) return indexedPayload

  return []
}

/* Tags*/
async function getTags() {
  const response = await fetch('http://localhost:3000/tags')
  const data = await response.json()
  const normalized = toArrayPayload(data)
  console.log('[vmusic][getTags]', {
    status: response.status,
    dataType: typeof data,
    isArray: Array.isArray(data),
    keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 10) : [],
    normalizedLength: normalized.length,
    sample: normalized[0]
  })

  return normalized.sort((a, b) => a.name.localeCompare(b.name))
}

async function getArtists(filter = false) {
  const response = await fetch('http://localhost:3000/artists')
  const data = await response.json()
  const normalized = toArrayPayload(data)
  console.log('[vmusic][getArtists]', {
    status: response.status,
    dataType: typeof data,
    isArray: Array.isArray(data),
    keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 10) : [],
    normalizedLength: normalized.length,
    sample: normalized[0]
  })

  return normalized.sort((a, b) => a.name.localeCompare(b.name))
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
  const effectiveArtists = artists.value.map((artist) => artist.id)
  const effectiveTags = tags.value.map((tag) => tag.id)

  const params = {
    artists: effectiveArtists,
    tags: effectiveTags
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
  const normalized = toArrayPayload(data)
  const storedCoverMap = getStoredCoverMap()
  console.log('[vmusic][filterSongs]', {
    status: response.status,
    requestArtists: params.artists?.length || 0,
    requestTags: params.tags?.length || 0,
    dataType: typeof data,
    isArray: Array.isArray(data),
    keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 10) : [],
    normalizedLength: normalized.length,
    sample: normalized[0]
  })
  const modeAdjustedSongs = applyCombinedFilters(normalized)
  songs.value = modeAdjustedSongs.map((item) => ({
    ...item,
    Artists: Array.isArray(item.Artists) ? item.Artists : [],
    Composers: Array.isArray(item.Composers) ? item.Composers : [],
    Tags: Array.isArray(item.Tags) ? item.Tags : [],
    coverUrl: getSongCoverUrl(item, storedCoverMap),
    hasCover: songHasCover(item, storedCoverMap),
    key: item.id,
    artistsJoined: (Array.isArray(item.Artists) ? item.Artists : [])
      .map((artist) => artist.name)
      .join(', '),
    composersJoined: (Array.isArray(item.Composers) ? item.Composers : [])
      .map((composer) => composer.name)
      .join(', '),
    nameNorm: removeAccents((item.name || '').toLowerCase()),
    artistsNorm: removeAccents(
      (Array.isArray(item.Artists) ? item.Artists : [])
        .map((artist) => artist.name)
        .join(' ')
        .toLowerCase()
    ),
    playCount: item.playCount || 0
  }))

  if (libraryState.value && libraryState.value.search?.length > 0) {
    filterQuery.value = libraryState.value.search
    debouncedFilterQuery.value = libraryState.value.search

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

function normalizeSelectionIds(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => {
      if (value === null || value === undefined) return null
      if (typeof value === 'object') return value.id ?? null

      return value
    })
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value))
}

function applyCombinedFilters(items) {
  const selectedArtistIds = normalizeSelectionIds(selectedArtists.value)
  const selectedTagIds = normalizeSelectionIds(selectedTags.value)

  const allArtistIds = normalizeSelectionIds(artists.value.map((artist) => artist.id))
  const allTagIds = normalizeSelectionIds(tags.value.map((tag) => tag.id))

  const hasArtistFilter =
    selectedArtistIds.length > 0 && selectedArtistIds.length < allArtistIds.length
  const hasTagFilter = selectedTagIds.length > 0 && selectedTagIds.length < allTagIds.length
  const hasNoArtistsSelected = selectedArtistIds.length === 0
  const hasNoTagsSelected = selectedTagIds.length === 0

  if (hasNoArtistsSelected || hasNoTagsSelected) {
    return []
  }

  return items.filter((song) => {
    const songArtistIds = new Set((song.Artists || []).map((artist) => String(artist.id)))
    const songTagIds = new Set((song.Tags || []).map((tag) => String(tag.id)))

    const artistMatch = !hasArtistFilter
      ? true
      : artistFilterMode.value === 'all'
        ? selectedArtistIds.every((artistId) => songArtistIds.has(artistId))
        : selectedArtistIds.some((artistId) => songArtistIds.has(artistId))

    const tagMatch = !hasTagFilter
      ? true
      : tagFilterMode.value === 'all'
        ? selectedTagIds.every((tagId) => songTagIds.has(tagId))
        : selectedTagIds.some((tagId) => songTagIds.has(tagId))

    return artistMatch && tagMatch
  })
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
  songContextMenu.value.visible = false
}

// Context menu for playlists
const songContextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  song: null
})
const savedPlaylists = ref([])
const quickCreatePlaylistModalVisible = ref(false)
const quickPlaylistName = ref('')

async function fetchSavedPlaylists() {
  try {
    const { data } = await axios.get('http://localhost:3000/playlists')
    savedPlaylists.value = data
  } catch (error) {
    console.error('Error al cargar playlists:', error)
  }
}

function openSongContextMenu(event, song) {
  songContextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    song
  }
  fetchSavedPlaylists()
}

async function addSongToPlaylist(playlistId) {
  if (!songContextMenu.value.song) return
  try {
    await axios.post(`http://localhost:3000/playlists/${playlistId}/add-songs`, {
      songIds: [songContextMenu.value.song.id]
    })
    message.success('Canción agregada a la playlist')
  } catch (error) {
    console.error('Error al agregar canción:', error)
    message.error('Error al agregar canción')
  }
  songContextMenu.value.visible = false
}

function createNewPlaylistWithSong() {
  quickPlaylistName.value = `Playlist ${dayjs().format('YYYY-MM-DD HH:mm')}`
  quickCreatePlaylistModalVisible.value = true
  songContextMenu.value.visible = false
}

async function confirmQuickCreatePlaylist() {
  try {
    const songIds = songContextMenu.value.song ? [songContextMenu.value.song.id] : []
    await axios.post('http://localhost:3000/playlists', {
      name: quickPlaylistName.value,
      songIds
    })
    message.success('Playlist creada')
    quickCreatePlaylistModalVisible.value = false
  } catch (error) {
    console.error('Error al crear playlist:', error)
    message.error('Error al crear playlist')
  }
}

function deleteSong() {
  if (selectedSongs.value.length === 0) return
  const songIdToDelete = selectedSongs.value[0]

  axios
    .post('http://localhost:3000/songs/delete', {
      id: songIdToDelete
    })
    .then(function (response) {
      filteredSongs.value = filteredSongs.value.filter((song) => song.id !== response.data[0])
      deletedSongs.value.push(response.data[0])
      markSongAsDeleted(songIdToDelete)
    })
    .catch(function (error) {})
    .finally(function () {
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

function shufflePlaylist(event) {
  if (playlistDetails.value.length <= 1) return

  const shuffleFromSelectedNext = Boolean(event?.altKey) && selectedRows.value.length > 0
  const selectedIndex = shuffleFromSelectedNext
    ? playlistDetails.value.findIndex((item) => item.entryId === selectedRows.value[0])
    : -1
  const startShuffleIndex = selectedIndex >= 0 ? selectedIndex + 1 : 0

  if (startShuffleIndex >= playlistDetails.value.length - 1) return

  const shuffled = [...playlistDetails.value]

  for (let i = shuffled.length - 1; i > startShuffleIndex; i--) {
    const j = startShuffleIndex + Math.floor(Math.random() * (i - startShuffleIndex + 1))
    const current = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = current
  }

  playlistDetails.value = shuffled
  syncPlaylistStateFromDetails()

  if (selectedRows.value.length > 0) {
    const stillPresent = selectedRows.value.filter((entryId) =>
      shuffled.some((item) => item.entryId === entryId)
    )
    selectedRows.value = stillPresent
  }
}

// Playlist save/load functionality
const savePlaylistModalVisible = ref(false)
const playlistNameToSave = ref('')
const savePlaylistError = ref('')
const defaultPlaylistName = computed(() => {
  return `Playlist ${dayjs().format('YYYY-MM-DD HH:mm')}`
})

function openSavePlaylistModal() {
  playlistNameToSave.value = defaultPlaylistName.value
  savePlaylistError.value = ''
  savePlaylistModalVisible.value = true
}

async function savePlaylist() {
  try {
    savePlaylistError.value = ''
    const songIds = playlistDetails.value.map((item) => item.id)
    await axios.post('http://localhost:3000/playlists', {
      name: playlistNameToSave.value,
      songIds
    })
    savePlaylistModalVisible.value = false
    message.success('Playlist guardada')
  } catch (error) {
    console.error('Error al guardar playlist:', error)
    savePlaylistError.value = 'Error al guardar la playlist'
  }
}

function onLoadPlaylist({ songs: playlistSongs, mode, name }) {
  // Convertir PlaylistSongs a entries compatibles
  const entries = []

  for (const ps of playlistSongs) {
    // ps.Song contiene los datos de la canción desde el backend
    const songData = ps.Song
    if (!songData) continue // Omitir silenciosamente si no existe

    const entry = {
      ...songData,
      Artists: songData.Artists || [],
      Composers: songData.Composers || [],
      Tags: songData.Tags || [],
      entryId: generateEntryId(),
      played: false
    }
    entries.push(entry)
  }

  if (mode === 'replace') {
    playlistDetails.value = entries
  } else {
    // Agregar al final
    playlistDetails.value.push(...entries)
  }

  syncPlaylistStateFromDetails()
  selectedRows.value = []
  message.success(`Playlist "${name}" cargada (${entries.length} canciones)`)
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
    .then(function (response) {
      let temp = []
      ids.forEach((item) => {
        temp.push(response.data.filter((s) => s.id === item)[0])
      })

      // Para modo aleatorio (action === 3), ordenar por playCount ascendente
      // después de hacer shuffle, para que las canciones con menos reproducciones suenen primero
      if (action === 3) {
        temp.sort((a, b) => (a.playCount || 0) - (b.playCount || 0))
      }

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
    .catch(function (error) {
      console.log(error)
    })
    .finally(function () {
      loadPlayers(play)
    })
}

function addToPlaylist(action, play = false, options = {}) {
  const useFilteredSongsForRandom = action === 3 && selectedSongs.value.length === 0
  const songIds = useFilteredSongsForRandom
    ? filteredSongs2.value.map((song) => song.id)
    : selectedSongs.value
  addSongsToPlaylist(songIds, action, play, options)
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
  const shouldLoadPlayer1 =
    player1Status === playerStatuses.Detenido || player1Status === playerStatuses['Sin Carga']
  const shouldLoadPlayer2 =
    player2Status === playerStatuses.Detenido || player2Status === playerStatuses['Sin Carga']

  if (initialDeckBLoadTimer) {
    clearTimeout(initialDeckBLoadTimer)
    initialDeckBLoadTimer = null
  }

  if (shouldLoadPlayer1) {
    let nextSong = getFirstUnplayedSong()
    if (nextSong && player1.value) {
      player1.value.setSong(nextSong)
      rememberActiveDeck(player1.value)
    }
  }

  if (shouldLoadPlayer2) {
    const loadDeckB = () => {
      initialDeckBLoadTimer = null
      const currentPlayer2Status = player2.value?.status
      const stillNeedsLoad =
        currentPlayer2Status === playerStatuses.Detenido ||
        currentPlayer2Status === playerStatuses['Sin Carga']
      if (!stillNeedsLoad) return

      const nextSong = getFirstUnplayedSong()
      if (nextSong && player2.value) {
        player2.value.setSong(nextSong)
        if (!lastActiveDeckPosition.value) {
          rememberActiveDeck(player2.value)
        }
      }
    }

    if (shouldLoadPlayer1) {
      initialDeckBLoadTimer = setTimeout(loadDeckB, 1000)
    } else {
      loadDeckB()
    }
  }

  if (play) {
    if (isFirstPlay.value) {
      if (player1.value.status === playerStatuses.Listo) {
        isFirstPlay.value = false
        player1.value.play()
      }
    } else {
      const targetPlayer = getReadyPlayerForPlayback()
      if (!autopause.value && targetPlayer) {
        targetPlayer.play()
      }
    }
  }
}

function loadDeck(deck) {
  const index = playlistDetails.value.findIndex((item) => item.entryId === selectedRows.value[0])
  if (index === -1) return

  const [found] = playlistDetails.value.splice(index, 1)
  const targetPlayer = deck === 'A' ? player1.value : player2.value
  const canSwapLoadedSong =
    targetPlayer &&
    (targetPlayer.status === playerStatuses.Listo || targetPlayer.status === playerStatuses.Pausado)
  const canLoadDirectly =
    targetPlayer &&
    (targetPlayer.status === playerStatuses.Detenido ||
      targetPlayer.status === playerStatuses['Sin Carga'])

  if (canSwapLoadedSong) {
    const songToInsert = targetPlayer.songFull?.entryId
      ? targetPlayer.songFull
      : targetPlayer.songFull
        ? createPlaylistEntry(targetPlayer.songFull)
        : null
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

  syncPlaylistStateFromDetails()
  selectedRows.value = []
}

function isDeckManualLoadDisabled(deck) {
  if (deck === 'A') {
    return (
      !player1.value ||
      player1.value.status === playerStatuses.Reproduciendo ||
      player1.value.status === playerStatuses.Cambiando
    )
  }

  return (
    !player2.value ||
    player2.value.status === playerStatuses.Reproduciendo ||
    player2.value.status === playerStatuses.Cambiando
  )
}

function loadLibrarySongToDeck(song, deck) {
  if (!song) return

  const entry = song.entryId ? song : createPlaylistEntry(song)
  const targetPlayer = deck === 'A' ? player1.value : player2.value
  if (!targetPlayer) return

  if (
    targetPlayer.status === playerStatuses.Listo ||
    targetPlayer.status === playerStatuses.Pausado ||
    targetPlayer.status === playerStatuses.Detenido ||
    targetPlayer.status === playerStatuses['Sin Carga']
  ) {
    targetPlayer.setSong(entry)
  }
}

function openWaveEditorForSong(song) {
  if (!song?.id) return
  selectedSongs.value = [song.id]
  currentSelectedOption.value = options.wave
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
  const targetPlayer = getReadyPlayerForPlayback()
  if (!targetPlayer) return

  if (isFirstPlay.value && targetPlayer === player1.value) {
    isFirstPlay.value = false
  }

  targetPlayer.play()
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

function isDeckReadyForAutoTransition(playerRef) {
  if (!playerRef) return false

  return isPlayerReady(playerRef)
}

function songFading(p) {
  if (p.position === 'top') {
    if (isDeckReadyForAutoTransition(player2.value) && !autopause.value) {
      player2.value.play()
    }
  } else if (p.position === 'bottom') {
    if (isDeckReadyForAutoTransition(player1.value) && !autopause.value) {
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
    player1Status === playerStatuses.Detenido ||
    player1Status === playerStatuses['Sin Carga'] ||
    player2Status === playerStatuses.Detenido ||
    player2Status === playerStatuses['Sin Carga']
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
  playlistPreviewPressTimer = setTimeout(async () => {
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
      haystack: removeAccents(
        `${song.name} ${song.Artists.map((i) => i.name).join(' ')}`
      ).toLowerCase()
    }))
    .filter((item) => item.haystack.includes(query))

  playlistSearchResults.value = matches

  if (matches.length > 0) {
    focusPlaylistResult(0)
  }
}

function focusPlaylistResult(targetIndex) {
  if (playlistSearchResults.value.length === 0) return

  const normalizedIndex =
    (targetIndex + playlistSearchResults.value.length) % playlistSearchResults.value.length
  playlistSearchIndex.value = normalizedIndex

  const result = playlistSearchResults.value[normalizedIndex]
  selectedRows.value = [result.entryId]
  scrollPlaylistTo(result.index)

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
  if (!song?.entryId) return false

  return repeatedArtistWarningSet.value.has(song.entryId)
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

async function onAddMp3Saved() {
  tags.value = await getTags()
  artists.value = await getArtists(true)
  setOption(options.library)
}

async function settingsSaved() {
  const s = JSON.parse(localStorage.getItem('vmusic_settings')) || {}
  previewSinkId.value = s.previewSinkId || null
  deckSinkId.value = s.deckSinkId || null
  excludedTags.value = s.excludeTags || []
  colorSchema.value = applyColorSchema(s.colorSchema)
  showAdvancedFunctions.value = Boolean(s.showAdvancedFunctions)
  await preparePreviewOutput()
  await initializePreferredOutputDevices()
  if (Boolean(s.autoUpdateCovers)) {
    player1.value?.resolveMissingCover?.()
    player2.value?.resolveMissingCover?.()
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

async function coverUpdated(payload) {
  const targetId = typeof payload === 'object' ? payload?.id : payload
  if (!targetId) return

  const updatedSong = await refreshSongInLibrary(targetId)
  if (updatedSong) {
    refreshEditedSongInLoadedPlayers(updatedSong)
  }
}

async function updated(payload) {
  const targetId = typeof payload === 'object' ? payload?.id : payload
  const targetCoverUrl = typeof payload === 'object' ? payload?.coverUrl : ''
  const targetYtid = typeof payload === 'object' ? payload?.ytid : ''
  const resolvedTargetId = targetId || selectedSongs.value[0]
  isLoadingLibrary.value = true
  await filterSongs()
  const updatedSong = await refreshSongInLibrary(resolvedTargetId)
  let hydratedSong = updatedSong
  if (updatedSong) {
    hydratedSong = {
      ...updatedSong,
      coverUrl: targetCoverUrl || updatedSong.coverUrl || '',
      hasCover: Boolean(targetCoverUrl || updatedSong.coverUrl || updatedSong.hasCover),
      ytid: targetYtid || updatedSong.ytid
    }
  }
  refreshEditedSongInLoadedPlayers(hydratedSong)
  isLoadingLibrary.value = false
  await setOption(null)
}

async function refreshSongInLibrary(id) {
  if (!id) return null

  try {
    const response = await axios.get(`http://localhost:3000/songs/${id}`)
    const updatedSong = response.data
    const storedCoverMap = getStoredCoverMap()
    const normalizedSong = {
      ...updatedSong,
      key: updatedSong.id,
      coverUrl: getSongCoverUrl(updatedSong, storedCoverMap),
      hasCover: songHasCover(updatedSong, storedCoverMap),
      artistsJoined: (Array.isArray(updatedSong.Artists) ? updatedSong.Artists : [])
        .map((artist) => artist.name)
        .join(', '),
      composersJoined: (Array.isArray(updatedSong.Composers) ? updatedSong.Composers : [])
        .map((composer) => composer.name)
        .join(', '),
      nameNorm: removeAccents((updatedSong.name || '').toLowerCase()),
      artistsNorm: removeAccents(
        (Array.isArray(updatedSong.Artists) ? updatedSong.Artists : [])
          .map((artist) => artist.name)
          .join(' ')
          .toLowerCase()
      )
    }

    const index = songs.value.findIndex((song) => song.id === id)
    if (index !== -1) {
      songs.value.splice(index, 1, normalizedSong)
    }

    return normalizedSong
  } catch (error) {
    console.log(error)

    return null
  }
}

function refreshEditedSongInLoadedPlayer(playerRef, updatedSong) {
  if (!playerRef?.songFull?.id || !updatedSong?.id || playerRef.songFull.id !== updatedSong.id)
    return
  if (typeof playerRef.updateSongMetadata !== 'function') return

  playerRef.updateSongMetadata(updatedSong)
}

function refreshEditedSongInLoadedPlayers(updatedSong) {
  refreshEditedSongInLoadedPlayer(player1.value, updatedSong)
  refreshEditedSongInLoadedPlayer(player2.value, updatedSong)
}

function reloadEditedSongInInactivePlayer(playerRef, songId, markers) {
  if (!playerRef?.songFull?.id || playerRef.songFull.id !== songId) return
  if (playerRef.status !== playerStatuses.Listo && playerRef.status !== playerStatuses.Pausado)
    return

  playerRef.setSong({
    ...playerRef.songFull,
    start: markers.start,
    end: markers.end
  })
}

function reloadEditedSongInInactivePlayers(songId, markers) {
  reloadEditedSongInInactivePlayer(player1.value, songId, markers)
  reloadEditedSongInInactivePlayer(player2.value, songId, markers)
}

function waveUpdated(markers) {
  const editedSongId = selectedSongs.value[0]

  axios
    .post('http://localhost:3000/songs/update-markers/' + editedSongId, markers)
    .then(function () {
      reloadEditedSongInInactivePlayers(editedSongId, markers)
    })
    .catch(function (error) {
      console.log(error)
    })
    .finally(function () {
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
    .then(function (response) {})
}

function next() {
  if (!player1.value || !player2.value) return
  if (isDeckAInitialPreprocessBlockingPlayback.value) return
  if (isNextDeckSpeedPreprocessBlocking.value) return
  const activePlayer = getActivePlayerForManualNext()
  if (!activePlayer) return
  activePlayer.next()
}

function rememberActiveDeck(playerRef) {
  if (!playerRef?.position) return
  lastActiveDeckPosition.value = playerRef.position
}

function getMediaTargetPlayer() {
  if (!player1.value || !player2.value) return null

  if (player1.value.status === playerStatuses.Reproduciendo) return player1.value
  if (player2.value.status === playerStatuses.Reproduciendo) return player2.value

  if (lastActiveDeckPosition.value === 'top' && player1.value.songFull?.id) {
    return player1.value
  }

  if (lastActiveDeckPosition.value === 'bottom' && player2.value.songFull?.id) {
    return player2.value
  }

  if (
    player1.value.status === playerStatuses.Pausado ||
    player1.value.status === playerStatuses.Listo
  )
    return player1.value
  if (
    player2.value.status === playerStatuses.Pausado ||
    player2.value.status === playerStatuses.Listo
  )
    return player2.value

  return null
}

const centerVisualizerPlayer = computed(() => {
  const active = getMediaTargetPlayer()
  if (active?.songFull?.id) return active
  if (player1.value?.songFull?.id) return player1.value
  if (player2.value?.songFull?.id) return player2.value

  return null
})

const shouldShowCenterVisualizer = computed(() => {
  return (
    false && centerVisualizerEnabled.value && Boolean(centerVisualizerPlayer.value?.songFull?.id)
  )
})

const centerVisualizerDeckClass = computed(() => {
  if (centerVisualizerPlayer.value?.position === 'top') return 'vm-center-visualizer-a'
  if (centerVisualizerPlayer.value?.position === 'bottom') return 'vm-center-visualizer-b'

  return 'vm-center-visualizer-idle'
})

const centerVisualizerAnimating = computed(() => {
  const status = centerVisualizerPlayer.value?.status

  return (
    status === playerStatuses.Reproduciendo ||
    status === playerStatuses.Cambiando ||
    status === playerStatuses.Nivelando
  )
})

function formatVisualizerTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const centerVisualizerTimeText = computed(() => {
  const duration = Number(centerVisualizerPlayer.value?.songFull?.duration || 0)
  const left = Number(centerVisualizerPlayer.value?.left || 0)
  const elapsed = Math.max(0, duration - left)

  return `${formatVisualizerTime(elapsed)} / ${formatVisualizerTime(duration)}`
})

function resetCenterVisualizerBars() {
  centerVisualizerBarHeights.value = Array.from({ length: CENTER_VISUALIZER_BAR_COUNT }, () => 0.16)
  centerVisualizerDebugRms.value = 0
}

function clearCenterVisualizerRetryListeners() {
  if (centerVisualizerRetryTimeoutId) {
    clearTimeout(centerVisualizerRetryTimeoutId)
    centerVisualizerRetryTimeoutId = null
  }

  if (!centerVisualizerRetryMedia || !centerVisualizerRetryHandler) return

  centerVisualizerRetryMedia.removeEventListener('loadeddata', centerVisualizerRetryHandler)
  centerVisualizerRetryMedia.removeEventListener('loadedmetadata', centerVisualizerRetryHandler)
  centerVisualizerRetryMedia.removeEventListener('canplay', centerVisualizerRetryHandler)
  centerVisualizerRetryMedia.removeEventListener('play', centerVisualizerRetryHandler)
  centerVisualizerRetryMedia.removeEventListener('playing', centerVisualizerRetryHandler)
  centerVisualizerRetryMedia.removeEventListener('timeupdate', centerVisualizerRetryHandler)
  centerVisualizerRetryMedia.removeEventListener('seeked', centerVisualizerRetryHandler)
  centerVisualizerRetryMedia.removeEventListener('ratechange', centerVisualizerRetryHandler)
  centerVisualizerRetryMedia = null
  centerVisualizerRetryHandler = null
  centerVisualizerRetryAttempt = 0
}

function scheduleCenterVisualizerRetryTick() {
  if (!centerVisualizerRetryMedia) return
  if (centerVisualizerRetryAttempt >= CENTER_VISUALIZER_RETRY_MAX_ATTEMPTS) return

  if (centerVisualizerRetryTimeoutId) {
    clearTimeout(centerVisualizerRetryTimeoutId)
  }

  centerVisualizerRetryAttempt += 1
  centerVisualizerRetryTimeoutId = setTimeout(() => {
    centerVisualizerRetryTimeoutId = null
    ensureCenterVisualizerAnalysis()
  }, CENTER_VISUALIZER_RETRY_DELAY_MS)
}

function scheduleCenterVisualizerRetry(media) {
  if (!media) return
  if (centerVisualizerRetryMedia === media && centerVisualizerRetryHandler) {
    scheduleCenterVisualizerRetryTick()

    return
  }

  clearCenterVisualizerRetryListeners()
  centerVisualizerRetryMedia = media
  centerVisualizerRetryHandler = () => {
    ensureCenterVisualizerAnalysis()
  }

  media.addEventListener('loadeddata', centerVisualizerRetryHandler, { once: true })
  media.addEventListener('loadedmetadata', centerVisualizerRetryHandler, { once: true })
  media.addEventListener('canplay', centerVisualizerRetryHandler, { once: true })
  media.addEventListener('play', centerVisualizerRetryHandler, { once: true })
  media.addEventListener('playing', centerVisualizerRetryHandler, { once: true })
  media.addEventListener('timeupdate', centerVisualizerRetryHandler, { once: true })
  media.addEventListener('seeked', centerVisualizerRetryHandler, { once: true })
  media.addEventListener('ratechange', centerVisualizerRetryHandler, { once: true })
  scheduleCenterVisualizerRetryTick()
}

function stopCenterVisualizerAnalysis() {
  if (centerVisualizerFrameId) {
    cancelAnimationFrame(centerVisualizerFrameId)
    centerVisualizerFrameId = null
  }

  if (centerVisualizerSourceNode) {
    try {
      centerVisualizerSourceNode.disconnect()
    } catch (error) {}
    centerVisualizerSourceNode = null
  }

  if (centerVisualizerAnalyser) {
    try {
      centerVisualizerAnalyser.disconnect()
    } catch (error) {}
    centerVisualizerAnalyser = null
  }

  centerVisualizerBoundMedia = null
  centerVisualizerDataBuffer = null
  clearCenterVisualizerRetryListeners()
  resetCenterVisualizerBars()
}

function updateCenterVisualizerBars() {
  if (!centerVisualizerAnalyser || !centerVisualizerDataBuffer) return

  centerVisualizerAnalyser.getFloatTimeDomainData(centerVisualizerDataBuffer)
  const buffer = centerVisualizerDataBuffer
  const segmentSize = Math.max(1, Math.floor(buffer.length / CENTER_VISUALIZER_BAR_COUNT))
  const nextHeights = []
  let totalSumSquares = 0
  let totalCount = 0

  for (let barIndex = 0; barIndex < CENTER_VISUALIZER_BAR_COUNT; barIndex++) {
    const startIndex = barIndex * segmentSize
    const endIndex = Math.min(buffer.length, startIndex + segmentSize)
    let sumSquares = 0
    let count = 0

    for (let index = startIndex; index < endIndex; index++) {
      const sample = buffer[index]
      sumSquares += sample * sample
      totalSumSquares += sample * sample
      count += 1
      totalCount += 1
    }

    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0
    const normalized = Math.min(1, Math.max(0.08, rms * 8.5))
    const previous = centerVisualizerBarHeights.value[barIndex] || 0.16
    const smoothed = previous * 0.68 + normalized * 0.32
    nextHeights.push(smoothed)
  }

  centerVisualizerDebugRms.value = totalCount > 0 ? Math.sqrt(totalSumSquares / totalCount) : 0
  centerVisualizerBarHeights.value = nextHeights
  centerVisualizerFrameId = requestAnimationFrame(updateCenterVisualizerBars)
}

async function ensureCenterVisualizerAnalysis() {
  if (!centerVisualizerEnabled.value) {
    stopCenterVisualizerAnalysis()

    return
  }

  const media = centerVisualizerPlayer.value?.getMediaElement?.()
  if (!media) {
    stopCenterVisualizerAnalysis()

    return
  }

  if (centerVisualizerBoundMedia === media && centerVisualizerAnalyser) {
    if (!centerVisualizerFrameId) {
      centerVisualizerFrameId = requestAnimationFrame(updateCenterVisualizerBars)
    }

    return
  }

  stopCenterVisualizerAnalysis()

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextCtor) return

  if (!centerVisualizerAudioContext) {
    centerVisualizerAudioContext = new AudioContextCtor()
  }

  if (centerVisualizerAudioContext.state === 'suspended') {
    try {
      await centerVisualizerAudioContext.resume()
    } catch (error) {}
  }

  const stream =
    typeof media.captureStream === 'function'
      ? media.captureStream()
      : typeof media.mozCaptureStream === 'function'
        ? media.mozCaptureStream()
        : null
  if (!stream) {
    scheduleCenterVisualizerRetry(media)

    return
  }

  const audioTracks = typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : []
  if (!audioTracks || audioTracks.length <= 0) {
    scheduleCenterVisualizerRetry(media)

    return
  }

  centerVisualizerAnalyser = centerVisualizerAudioContext.createAnalyser()
  centerVisualizerAnalyser.fftSize = 2048
  centerVisualizerAnalyser.smoothingTimeConstant = 0.72
  centerVisualizerDataBuffer = new Float32Array(centerVisualizerAnalyser.fftSize)
  centerVisualizerSourceNode = centerVisualizerAudioContext.createMediaStreamSource(stream)
  centerVisualizerSourceNode.connect(centerVisualizerAnalyser)
  centerVisualizerBoundMedia = media
  centerVisualizerFrameId = requestAnimationFrame(updateCenterVisualizerBars)
}

watch(
  () => [
    centerVisualizerEnabled.value,
    centerVisualizerPlayer.value?.position,
    centerVisualizerPlayer.value?.songFull?.id,
    centerVisualizerPlayer.value?.status,
    centerVisualizerPlayer.value?.left
  ],
  () => {
    ensureCenterVisualizerAnalysis()
  },
  { immediate: true }
)

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

  const playing =
    player1.value?.status === playerStatuses.Reproduciendo ||
    player2.value?.status === playerStatuses.Reproduciendo
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

  const artistNames = Array.isArray(song.Artists)
    ? song.Artists.map((artist) => artist.name).join(', ')
    : ''
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
      if (
        player1.value?.status === playerStatuses.Reproduciendo ||
        player2.value?.status === playerStatuses.Reproduciendo
      ) {
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

function isEditableKeyboardTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  const tagName = target.tagName

  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
}

function seekActivePlayer(deltaSeconds) {
  const targetPlayer = getMediaTargetPlayer()
  if (!targetPlayer || typeof targetPlayer.seekBy !== 'function') return false
  if (!isPlayerReady(targetPlayer)) return false

  targetPlayer.seekBy(deltaSeconds)

  return true
}

function adjustActivePlayerSpeed(delta) {
  const targetPlayer = getMediaTargetPlayer()
  if (!targetPlayer || typeof targetPlayer.setSpeed !== 'function') return false

  targetPlayer.setSpeed(delta)

  return true
}

function resetActivePlayerSpeed() {
  const targetPlayer = getMediaTargetPlayer()
  if (!targetPlayer || typeof targetPlayer.setSpeed !== 'function') return false

  const currentOffset = Number(targetPlayer.speed_added || 0)
  if (!Number.isFinite(currentOffset) || currentOffset === 0) return false

  targetPlayer.setSpeed(-currentOffset)

  return true
}

function isPlayerActivelyPlaying(playerRef) {
  if (!playerRef) return false

  return (
    playerRef.status === playerStatuses.Reproduciendo ||
    playerRef.status === playerStatuses.Cambiando ||
    playerRef.status === playerStatuses.Nivelando
  )
}

function capturePlaybackStateBeforePowerInterruption() {
  playbackStateBeforePowerInterruption.value = {
    top: isPlayerActivelyPlaying(player1.value),
    bottom: isPlayerActivelyPlaying(player2.value)
  }
}

function restorePlaybackAfterPowerInterruption() {
  if (systemPowerResumeTimerId) {
    clearTimeout(systemPowerResumeTimerId)
    systemPowerResumeTimerId = null
  }

  systemPowerResumeTimerId = setTimeout(() => {
    if (player1.value?.setSinkId && deckSinkId.value) {
      player1.value.setSinkId(deckSinkId.value)
    }
    if (player2.value?.setSinkId && deckSinkId.value) {
      player2.value.setSinkId(deckSinkId.value)
    }

    if (
      playbackStateBeforePowerInterruption.value.top &&
      player1.value?.songFull?.id &&
      isPlayerReady(player1.value)
    ) {
      player1.value?.play?.()
    }
    if (
      playbackStateBeforePowerInterruption.value.bottom &&
      player2.value?.songFull?.id &&
      isPlayerReady(player2.value)
    ) {
      player2.value?.play?.()
    }
  }, 900)
}

function onSystemPowerEvent(_event, payload = {}) {
  const type = String(payload?.type || '')
  if (type === 'suspend' || type === 'lock-screen') {
    capturePlaybackStateBeforePowerInterruption()

    return
  }

  if (type === 'resume' || type === 'unlock-screen') {
    restorePlaybackAfterPowerInterruption()
  }
}

function onKeyboardSeekKey(event) {
  if (event.defaultPrevented || event.repeat) return
  if (isEditableKeyboardTarget(event.target)) return
  if (event.ctrlKey) return

  const normalizedKey = event.key.toLowerCase()
  const normalizedCode = event.code || ''

  if (
    normalizedCode === 'KeyZ' &&
    isLeftMetaPressed.value &&
    isLeftAltPressed.value &&
    isLeftShiftPressed.value
  ) {
    if (resetActivePlayerSpeed()) {
      event.preventDefault()
      event.stopPropagation()
    }

    return
  }

  if (event.metaKey && normalizedCode === 'KeyZ') {
    if (adjustActivePlayerSpeed(event.shiftKey ? KEYBOARD_SPEED_STEP : -KEYBOARD_SPEED_STEP)) {
      event.preventDefault()
      event.stopPropagation()
    }

    return
  }

  if (event.altKey) return

  if (event.key === 'ArrowDown') {
    if (adjustActivePlayerSpeed(-KEYBOARD_SPEED_STEP)) {
      event.preventDefault()
    }

    return
  }

  if (event.key === 'ArrowUp') {
    if (adjustActivePlayerSpeed(KEYBOARD_SPEED_STEP)) {
      event.preventDefault()
    }

    return
  }

  if (event.key === 'ArrowLeft') {
    if (seekActivePlayer(-KEYBOARD_SEEK_SECONDS)) {
      event.preventDefault()
    }

    return
  }

  if (event.key === 'ArrowRight' && seekActivePlayer(KEYBOARD_SEEK_SECONDS)) {
    event.preventDefault()
  }
}

function onModifierKeyDown(event) {
  if (event.key === 'Escape') {
    const handled = handleLibraryEscapeShortcut(event)
    if (handled) return
  }

  if (event.key === 'Alt' || event.altKey) {
    isAltPressed.value = true
  }

  if (event.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) {
    if (event.key === 'Alt') {
      isLeftAltPressed.value = true
    }
    if (event.key === 'Shift') {
      isLeftShiftPressed.value = true
    }
    if (event.key === 'Meta') {
      isLeftMetaPressed.value = true
    }
  }
}

function onModifierKeyUp(event) {
  if (event.key === 'Alt') {
    isAltPressed.value = false
  }

  if (event.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) {
    if (event.key === 'Alt') {
      isLeftAltPressed.value = false
    }
    if (event.key === 'Shift') {
      isLeftShiftPressed.value = false
    }
    if (event.key === 'Meta') {
      isLeftMetaPressed.value = false
    }
  }
}

function onWindowBlurResetModifiers() {
  isAltPressed.value = false
  isLeftAltPressed.value = false
  isLeftShiftPressed.value = false
  isLeftMetaPressed.value = false
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

function artistFilterModeChanged() {
  libraryState.value.page = 1
  filterSongs()
  saveLibraryView()
}

function artistFilterModeToggled(checked) {
  artistFilterMode.value = checked ? 'all' : 'any'
  artistFilterModeChanged()
}

function tagFilterModeChanged() {
  libraryState.value.page = 1
  filterSongs()
  saveLibraryView()
}

function tagFilterModeToggled(checked) {
  tagFilterMode.value = checked ? 'all' : 'any'
  tagFilterModeChanged()
}

function quickFilterByArtist(artistId) {
  // Select only the chosen artist and force all tags (including excluded ones)
  libraryState.value.page = 1
  selectedArtists.value = [artistId]
  selectedTags.value = tags.value.map((tag) => tag.id)
  filterQuery.value = ''
  debouncedFilterQuery.value = ''
  m3uExportSourceFilter.value = 'any'
  filterSongs()
  saveLibraryView()
}

function handleLibraryEscapeShortcut(event) {
  if (event.repeat) return false
  if (currentSelectedOption.value !== options.library) return false

  const now = Date.now()
  const isDoubleEscape =
    lastEscapePressAt > 0 && now - lastEscapePressAt < ESC_DOUBLE_PRESS_WINDOW_MS
  lastEscapePressAt = now
  event.preventDefault()
  filterQuery.value = ''
  debouncedFilterQuery.value = ''

  if (isDoubleEscape) {
    libraryState.value.page = 1
    selectAllLibraryFilters()

    return true
  }

  saveLibraryView()

  return true
}

function selectAllLibraryFilters() {
  const allArtistIds = artists.value.map((artist) => artist.id)
  const allowedTagIds = tags.value
    .filter((tag) => !excludedTags.value.includes(tag.id))
    .map((tag) => tag.id)

  selectedArtists.value = allArtistIds
  selectedTags.value = allowedTagIds
  m3uExportSourceFilter.value = 'any'
  artistFilterQuery.value = ''
  tagFilterQuery.value = ''

  if (artistMultiSelect.value?.setSelected) {
    artistMultiSelect.value.setSelected(allArtistIds)
  } else {
    artistMultiSelect.value?.selectAll?.()
  }

  if (tagMultiSelect.value?.setSelected) {
    tagMultiSelect.value.setSelected(allowedTagIds)
  } else {
    tagMultiSelect.value?.selectAll?.()
  }

  libraryState.value.page = 1
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
    .filter((t) => (ignoreExclusions ? true : !excludedTags.value.includes(t.id)))
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
  debouncedFilterQuery.value = songName || ''
  m3uExportSourceFilter.value = 'any'
  libraryState.value.page = 1
  await filterSongs()

  let targetIndex = -1
  if (songId) {
    targetIndex = filteredSongs2.value.findIndex((item) => item.id === songId)
  }
  if (targetIndex === -1 && songName) {
    const normalized = removeAccents(songName.toLowerCase())
    targetIndex = filteredSongs2.value.findIndex(
      (item) => removeAccents((item.name || '').toLowerCase()) === normalized
    )
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

function openInfoForSong(songData) {
  const songId = typeof songData === 'number' ? songData : songData?.id
  if (!songId) return

  selectedSongs.value = [songId]
  currentSelectedOption.value = options.edit
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

const lyricsLines = ref([])
const lyricsSynced = ref(false)
const lyricsLoading = ref(false)
const currentLyricIndex = ref(-1)
const currentWordIndex = ref(-1)
let lyricsActiveDeck = null
let activeLyricsPlayer = null
const lyricsFetchedSongs = new Set()

function clearLyrics() {
  lyricsLines.value = []
  lyricsSynced.value = false
  currentLyricIndex.value = -1
  currentWordIndex.value = -1
  lyricsActiveDeck = null
}

function handlePlayerLoaded(playerRef) {
  const active = getMediaTargetPlayer()
  if (active && active.position === playerRef.position) {
    clearLyrics()
  }
}

function handleLyricsTimeupdate(deck, currentTime) {
  if (deck !== lyricsActiveDeck) return
  const lines = lyricsLines.value
  if (!lines.length) return
  let idx = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (currentTime >= lines[i].time) {
      idx = i
      break
    }
  }
  if (idx !== currentLyricIndex.value) {
    currentLyricIndex.value = idx
    currentWordIndex.value = -1
  }
  if (idx < 0) return
  const line = lines[idx]
  const words = line.text.split(/\s+/).filter(Boolean)
  if (words.length <= 1) {
    currentWordIndex.value = -1
    return
  }
  const nextTime = idx + 1 < lines.length ? lines[idx + 1].time : currentTime + 10
  const lineDuration = nextTime - line.time
  const wordDuration = lineDuration / words.length
  const wordIdx = Math.min(
    Math.floor((currentTime - line.time) / wordDuration),
    words.length - 1
  )
  currentWordIndex.value = wordIdx
}

async function fetchLyricsForPlayer(playerRef) {
  if (!playerRef?.songFull) {
    lyricsLines.value = []
    lyricsSynced.value = false
    currentLyricIndex.value = -1
    return
  }
  const song = playerRef.songFull
  const artist = Array.isArray(song.Artists) && song.Artists.length > 0
    ? song.Artists[0].name
    : ''
  const title = song.name || ''
  if (!artist || !title) {
    lyricsLines.value = []
    lyricsSynced.value = false
    return
  }
  lyricsLoading.value = true
  lyricsLines.value = []
  lyricsSynced.value = false
  currentLyricIndex.value = -1
  try {
    const params = new URLSearchParams({
      artist,
      title
    })
    if (song.folder) params.set('folder', song.folder)
    if (song.ytid) params.set('ytid', song.ytid)
    const res = await fetch(`http://localhost:3000/lyrics?${params.toString()}`)
    const data = await res.json()
    if (data.lines && data.lines.length > 0) {
      lyricsLines.value = data.lines
      lyricsSynced.value = data.synced
      lyricsActiveDeck = playerRef.position
      if (song.id) lyricsFetchedSongs.add(song.id)
    }
  } catch {
    // silently fail
  } finally {
    lyricsLoading.value = false
  }
}

const shouldShowLyrics = computed(() => {
  return lyricsLines.value.length > 0 && lyricsSynced.value
})

const activeLyricsLine = computed(() => {
  const idx = currentLyricIndex.value
  if (idx < 0 || idx >= lyricsLines.value.length) return ''
  return lyricsLines.value[idx].text
})

const currentLyricsWord = computed(() => {
  const idx = currentLyricIndex.value
  const wordIdx = currentWordIndex.value
  if (idx < 0 || idx >= lyricsLines.value.length || wordIdx < 0) return ''
  const words = lyricsLines.value[idx].text.split(/\s+/).filter(Boolean)
  return words[wordIdx] || ''
})

const nextLyricsLine = computed(() => {
  const idx = currentLyricIndex.value + 1
  if (idx < 0 || idx >= lyricsLines.value.length) return ''
  return lyricsLines.value[idx].text
})

const prevLyricsLine = computed(() => {
  const idx = currentLyricIndex.value - 1
  if (idx < 0 || idx >= lyricsLines.value.length) return ''
  return lyricsLines.value[idx].text
})

watch(
  () => {
    const p1 = player1.value?.status || 0
    const p2 = player2.value?.status || 0
    return `${p1}:${p2}`
  },
  () => {
    const active = getMediaTargetPlayer()
    const position = active?.position || null
    if (!position) {
      clearLyrics()
      return
    }
    lyricsActiveDeck = position
    if (
      active.status === playerStatuses.Reproduciendo &&
      active?.songFull?.id &&
      !lyricsFetchedSongs.has(active.songFull.id)
    ) {
      fetchLyricsForPlayer(active)
    }
  }
)
</script>

<style>
.vm-side-alert-dot {
  position: absolute;
  top: 2px;
  right: 0;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: #ef4444;
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.9);
}

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

.vm-update-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 255, 255, 0.12), transparent 24%),
    radial-gradient(
      circle at 85% 18%,
      color-mix(in srgb, var(--vm-player-wave-a) 30%, transparent),
      transparent 30%
    ),
    radial-gradient(
      circle at bottom,
      color-mix(in srgb, var(--vm-player-wave-b) 24%, transparent),
      transparent 34%
    ),
    linear-gradient(180deg, #050505, #0c0d10 52%, #020202);
}

.vm-update-shell {
  position: relative;
  width: min(560px, 100%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  padding: 30px;
  text-align: left;
  border-radius: 34px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
    rgba(5, 6, 9, 0.84);
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.vm-update-shell-error {
  border-color: rgba(248, 113, 113, 0.28);
  background:
    linear-gradient(180deg, rgba(127, 29, 29, 0.24), rgba(255, 255, 255, 0.02)),
    rgba(17, 4, 6, 0.92);
}

.vm-update-shell-ready {
  border-color: color-mix(in srgb, var(--vm-player-wave-a) 30%, rgba(255, 255, 255, 0.1));
}

.vm-update-glow {
  position: absolute;
  inset: -40% auto auto 52%;
  width: 280px;
  height: 280px;
  border-radius: 999px;
  pointer-events: none;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--vm-player-wave-a) 32%, transparent),
    transparent 65%
  );
  filter: blur(10px);
  opacity: 0.9;
}

.vm-update-status-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.vm-update-pill {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.86);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.vm-update-pill-checking,
.vm-update-pill-available,
.vm-update-pill-downloading,
.vm-update-pill-installing {
  border-color: color-mix(in srgb, var(--vm-player-wave-a) 30%, transparent);
  background: color-mix(in srgb, var(--vm-player-wave-a) 14%, transparent);
}

.vm-update-pill-downloaded {
  border-color: color-mix(in srgb, var(--vm-player-wave-b) 34%, transparent);
  background: color-mix(in srgb, var(--vm-player-wave-b) 14%, transparent);
}

.vm-update-pill-error {
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(127, 29, 29, 0.34);
  color: #fecaca;
}

.vm-update-pill-preview {
  color: rgba(255, 255, 255, 0.72);
}

.vm-update-pill-dev::before {
  content: '';
  width: 7px;
  height: 7px;
  margin-right: 8px;
  border-radius: 999px;
  background: #facc15;
}

.vm-update-brand {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 4px;
}

.vm-update-mark {
  width: 74px;
  height: 74px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24px;
  background: linear-gradient(145deg, var(--vm-player-wave-a), var(--vm-player-wave-b));
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.26);
}

.vm-update-mark-error {
  background: linear-gradient(145deg, #7f1d1d, #ef4444);
}

.vm-update-mark-ready {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--vm-player-wave-a) 75%, #ffffff 25%),
    var(--vm-player-wave-b)
  );
}

.vm-update-mark-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.vm-update-name {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.82rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.vm-update-spinner {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.14);
  border-top-color: var(--vm-player-wave-a);
  border-right-color: var(--vm-player-wave-b);
  animation: vm-update-spin 1s linear infinite;
}

.vm-update-title {
  position: relative;
  z-index: 1;
  color: #fff;
  font-size: clamp(1.5rem, 2.6vw, 2.25rem);
  font-weight: 700;
  line-height: 1.04;
}

.vm-update-title-error {
  color: #fca5a5;
}

.vm-update-message {
  position: relative;
  z-index: 1;
  max-width: 470px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 1rem;
  line-height: 1.55;
}

.vm-update-message-error {
  color: rgba(254, 202, 202, 0.9);
}

.vm-update-version {
  position: relative;
  z-index: 1;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.vm-update-progress {
  width: 100%;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vm-update-progress-bar {
  width: 100%;
  height: 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.vm-update-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--vm-player-wave-a), var(--vm-player-wave-b));
  box-shadow: 0 0 24px color-mix(in srgb, var(--vm-player-wave-a) 34%, transparent);
  transition: width 220ms ease;
}

.vm-update-progress-caption {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.86rem;
}

.vm-update-meta {
  width: 100%;
  position: relative;
  z-index: 1;
  display: flex;
}

.vm-update-meta-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  width: 100%;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.04);
}

.vm-update-meta-label {
  color: rgba(255, 255, 255, 0.46);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.vm-update-meta-value {
  color: rgba(255, 255, 255, 0.88);
  font-size: 0.95rem;
  font-weight: 600;
}

.vm-update-actions {
  position: relative;
  z-index: 1;
  margin-top: 2px;
}

.vm-update-devtools {
  position: fixed;
  right: 18px;
  top: 18px;
  z-index: 80;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.vm-update-devtools-toggle,
.vm-update-devtools-chip {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.vm-update-devtools-toggle {
  padding: 10px 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--vm-player-wave-a), var(--vm-player-wave-b));
  color: #041014;
  font-weight: 700;
  letter-spacing: 0.04em;
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.24);
}

.vm-update-devtools-panel {
  width: min(320px, calc(100vw - 36px));
  padding: 16px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(10, 12, 18, 0.94);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(14px);
}

.vm-update-devtools-title {
  margin-bottom: 12px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.vm-update-devtools-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.vm-update-devtools-chip {
  padding: 9px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  transition:
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.vm-update-devtools-chip:hover,
.vm-update-devtools-chip.is-active {
  background: linear-gradient(135deg, var(--vm-player-wave-a), var(--vm-player-wave-b));
  color: #041014;
  transform: translateY(-1px);
}

.vm-song-note-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: rgb(68 64 60);
  cursor: help;
  transition:
    color 160ms ease,
    transform 160ms ease;
}

.vm-song-note-indicator:hover {
  color: rgb(41 37 36);
  transform: translateY(-1px);
}

.vm-song-note-tooltip {
  max-width: 260px;
  white-space: pre-wrap;
  line-height: 1.45;
}

@media (max-width: 640px) {
  .vm-update-screen {
    padding: 18px;
  }

  .vm-update-shell {
    padding: 24px 20px;
  }

  .vm-update-devtools {
    right: 14px;
    top: 14px;
  }

  .vm-update-status-row,
  .vm-update-brand,
  .vm-update-meta {
    flex-direction: column;
    align-items: flex-start;
  }
}

@keyframes vm-update-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.vm-center-stage {
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.vm-center-logo-wrap {
  width: 100%;
  max-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.vm-center-logo-wrap .vm-logo {
  width: min(100%, 720px);
  max-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vm-center-logo-wrap .vm-logo svg {
  max-height: 320px;
}

.vm-center-visualizer {
  position: relative;
  width: 100%;
  min-height: 340px;
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid transparent;
  background: transparent;
  box-shadow: none;
}

.vm-center-content {
  position: relative;
  z-index: 2;
  min-height: 340px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
}

.vm-center-meter {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0;
}

.vm-center-bars-wrap {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vm-center-times {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: none;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: clamp(0.78rem, 1.12vw, 1rem);
  font-weight: 700;
  letter-spacing: 0.18em;
  font-variant-numeric: tabular-nums;
  text-align: center;
  pointer-events: none;
  text-shadow:
    0 0 12px rgba(0, 0, 0, 0.9),
    0 0 28px rgba(0, 0, 0, 0.72),
    0 8px 18px rgba(0, 0, 0, 0.62);
}

.vm-center-rms-bars {
  display: flex;
  align-items: center;
  justify-content: stretch;
  gap: 4px;
  width: 100%;
  height: 296px;
  margin-top: 0;
  padding-left: 25px;
  box-sizing: border-box;
}

.vm-center-rms-bar {
  position: relative;
  flex: 1 1 0;
  min-width: 2px;
  height: 100%;
  border-radius: 0;
  transform-origin: center center;
  transition: transform 90ms linear;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--vm-player-wave-a) 72%, transparent) 0%,
    color-mix(in srgb, var(--vm-player-wave-b) 88%, white 12%) 30%,
    #ffffff 50%,
    color-mix(in srgb, var(--vm-player-wave-b) 88%, white 12%) 70%,
    color-mix(in srgb, var(--vm-player-wave-a) 72%, transparent) 100%
  );
  box-shadow:
    0 0 10px color-mix(in srgb, var(--vm-player-wave-b) 45%, transparent),
    0 0 18px color-mix(in srgb, #ffffff 24%, transparent);
}

.vm-center-rms-bar::before,
.vm-center-rms-bar::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 5px;
  height: 5px;
  border-radius: 0;
  transform: translateX(-50%);
  background: color-mix(in srgb, #ffffff 78%, var(--vm-player-wave-b) 22%);
  box-shadow:
    0 0 8px color-mix(in srgb, #ffffff 65%, transparent),
    0 0 14px color-mix(in srgb, var(--vm-player-wave-b) 38%, transparent);
}

.vm-center-rms-bar::before {
  top: 0;
}

.vm-center-rms-bar::after {
  bottom: 0;
}

.vm-center-visualizer-a {
  --vm-center-accent: var(--vm-player-wave-a);
}

.vm-center-visualizer-b {
  --vm-center-accent: var(--vm-player-wave-b);
}

.vm-center-visualizer-idle {
  --vm-center-accent: color-mix(in srgb, var(--vm-player-wave-a) 50%, var(--vm-player-wave-b) 50%);
}

@media (max-width: 900px) {
  .vm-center-visualizer,
  .vm-center-content {
    min-height: 260px;
  }

  .vm-center-rms-bars {
    gap: 3px;
    height: 216px;
  }
}

#app .vmusic-app .vm-logo stop:first-of-type {
  stop-color: var(--vm-player-wave-b) !important;
}

#app .vmusic-app .vm-logo stop:last-of-type {
  stop-color: var(--vm-player-wave-a) !important;
}

.playlist-quick-action.ant-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  white-space: nowrap !important;
  line-height: 1 !important;
}

.playlist-quick-action.ant-btn > span {
  display: inline-flex !important;
  align-items: center !important;
  white-space: nowrap !important;
  line-height: 1 !important;
}

.playlist-quick-action.ant-btn .ant-btn-icon {
  display: inline-flex !important;
  align-items: center !important;
  line-height: 1 !important;
}

.playlist-row-selected {
  background-color: color-mix(in srgb, var(--vm-player-wave-a) 58%, transparent) !important;
}

#app .vmusic-app .playlist-list-container tr:hover > td:not(.playlist-row-selected) {
  background-color: color-mix(in srgb, var(--vm-player-wave-a) 29%, transparent) !important;
}

#app .vmusic-app .playlist-list-container table.playlist-table tr:nth-child(even) {
  background-color: transparent !important;
}

#app .vmusic-app .playlist-list-container table.playlist-table tbody tr td {
  border-bottom: 1px solid color-mix(in srgb, #ffffff 6%, transparent);
}

#app .vmusic-app .playlist-list-container table.playlist-table tbody tr td.playlist-artist-cell {
  color: rgba(255, 255, 255, 0.5) !important;
}

#app .vmusic-app .playlist-list-container table.playlist-table tbody tr td.playlist-index-cell {
  width: 56px;
  min-width: 56px;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.4) !important;
}

#app .vmusic-app .playlist-list-container table.playlist-table tbody tr:last-child td {
  border-bottom-color: transparent;
}

#app .vmusic-app .playlist-list-container td.playlist-row-selected:first-child {
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--vm-player-wave-a) 80%, #ffffff 20%);
}

.vm-item-selected {
  background-color: var(--vm-neutral-row-selected) !important;
}

.vm-secondary-panel {
  --vm-neutral-accent: var(--vm-ant-primary);
  --vm-neutral-accent-hover: color-mix(in srgb, var(--vm-ant-primary) 84%, black 16%);
  --vm-neutral-accent-soft: color-mix(in srgb, var(--vm-ant-primary) 22%, black 78%);
  --vm-neutral-accent-ring: color-mix(in srgb, var(--vm-ant-primary) 28%, transparent);
  --vm-secondary-surface: color-mix(in srgb, #f1efed 97%, var(--vm-player-wave-a) 3%);
  --vm-secondary-panel-bg: color-mix(in srgb, #fbfaf8 98%, var(--vm-player-wave-a) 2%);
  --vm-secondary-control: color-mix(in srgb, #78716c 92%, var(--vm-player-wave-a) 8%);
  --vm-secondary-control-alt: color-mix(in srgb, #a8a29e 92%, var(--vm-player-wave-a) 8%);
  --vm-secondary-row-base: color-mix(in srgb, #fbfaf8 98%, var(--vm-player-wave-a) 2%);
  --vm-secondary-row-stripe: color-mix(in srgb, #faf8f6 98%, var(--vm-player-wave-a) 2%);
  --vm-neutral-row-selected: color-mix(in srgb, var(--vm-ant-primary) 14%, #ffffff 86%);
  --vm-neutral-row-hover: color-mix(in srgb, var(--vm-ant-primary) 9%, #ffffff 91%);
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
  background-color: rgba(0, 0, 0, 0.1) !important;
  color: #ffffff !important;
}

#app .vmusic-app {
  height: 100vh;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.42) 0%, rgba(0, 0, 0, 0) 52%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--vm-player-wave-a) 35%, black 65%) 0%,
      color-mix(in srgb, var(--vm-player-wave-b) 35%, black 65%) 100%
    ) !important;
}

#app .vmusic-app .vm-side-nav svg {
  color: #ffffff !important;
  opacity: 0.6;
}

#app .vmusic-app .vm-side-nav .vm-item-selected,
#app .vmusic-app .vm-side-nav .vm-item-selected svg {
  color: #000000 !important;
  opacity: 1;
}

#app .vmusic-app .vm-side-nav .vm-item-selected {
  background-color: color-mix(in srgb, #f1efed 97%, var(--vm-player-wave-a) 3%) !important;
}

#app .vmusic-app .playlist-list-container {
  background-color: transparent !important;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

#app .vmusic-app .playlist-list-container::-webkit-scrollbar {
  width: 0;
  height: 0;
}

#app .vm-filter-input-compact.ant-input,
#app .vm-filter-input-compact.ant-input-affix-wrapper,
#app .vm-filter-input-compact .ant-input {
  font-size: 0.875rem !important;
}

#app .vm-filter-input-compact.ant-input-affix-wrapper {
  min-height: 24px;
  padding-top: 1px !important;
  padding-bottom: 1px !important;
}
</style>

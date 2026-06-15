import { NvlOptions } from '@neo4j-nvl/base';
import { GraphType, OptionType, PatternOption } from '../types';
import { getDateTime, getDescriptionForChatMode } from './Utils';
import chatbotmessages from '../assets/ChatbotMessages.json';
import schemaExamples from '../assets/newSchema.json';
import { tr } from '../i18n';

// Builds a dictionary whose values are resolved from i18n at access time, so
// every consumer of these constants automatically reflects the active language
// (the app remounts on language change, re-reading these getters).
const i18nDict = <K extends string>(ns: string, keys: readonly K[]): Record<K, string> => {
  const dict = {} as Record<K, string>;
  keys.forEach((key) => {
    Object.defineProperty(dict, key, { enumerable: true, get: () => tr(`${ns}.${key}`) });
  });
  return dict;
};
export const APP_SOURCES =
  import.meta.env.VITE_REACT_APP_SOURCES && import.meta.env.VITE_REACT_APP_SOURCES !== ''
    ? (import.meta.env.VITE_REACT_APP_SOURCES?.split(',') as string[])
    : ['s3', 'local', 'wiki', 'youtube', 'web'];

export const llms = import.meta.env?.VITE_LLM_MODELS?.trim()
  ? (import.meta.env.VITE_LLM_MODELS.split(',') as string[])
  : [
      'gemini_3.5_flash',
      'openai_gpt_5.5',
      'openai_gpt_5.4_mini',
      'gemini_3.1_pro_preview',
      'diffbot',
      'groq_llama3.1_8b',
      'anthropic_claude_4.7_opus',
      'anthropic_claude_4.5_haiku',
      'llama4_maverick',
      'bedrock_nova_pro_v1',
      'fireworks_deepseek_v4_flash',
      'fireworks_qwen3_6',
      'fireworks_gpt_oss',
      'fireworks_kimi_k2p6',
      'fireworks_glm_5.1',
    ];

export const prodllms = import.meta.env.VITE_LLM_MODELS_PROD?.trim()
  ? (import.meta.env.VITE_LLM_MODELS_PROD.split(',') as string[])
  : ['gemini_3.5_flash', 'openai_gpt_5.4_mini', 'diffbot', 'anthropic_claude_4.5_haiku'];

export const chatModeLables = {
  vector: 'vector',
  graph: 'graph',
  'graph+vector': 'graph_vector',
  fulltext: 'fulltext',
  'graph+vector+fulltext': 'graph_vector_fulltext',
  'entity search+vector': 'entity_vector',
  get unavailableChatMode() {
    return tr('chatMode.unavailableChatMode');
  },
  get selected() {
    return tr('chatMode.selected');
  },
  'global search+vector+fulltext': 'global_vector',
};
export const chatModeReadableLables: Record<string, string> = {
  vector: 'vector',
  graph: 'graph',
  graph_vector: 'graph+vector',
  fulltext: 'fulltext',
  graph_vector_fulltext: 'graph+vector+fulltext',
  entity_vector: 'entity search+vector',
  get unavailableChatMode() {
    return tr('chatMode.unavailableChatMode');
  },
  get selected() {
    return tr('chatMode.selected');
  },
  global_vector: 'global search+vector+fulltext',
};
export const chatModes = import.meta.env?.VITE_CHAT_MODES?.trim()
  ? import.meta.env.VITE_CHAT_MODES?.split(',').map((mode: string) => ({
      mode: mode.trim(),
      description: getDescriptionForChatMode(mode.trim()),
    }))
  : [
      {
        mode: chatModeLables.vector,
        description: 'Performs semantic similarity search on text chunks using vector indexing.',
      },
      {
        mode: chatModeLables.graph,
        description: 'Translates text to Cypher queries for precise data retrieval from a graph database.',
      },
      {
        mode: chatModeLables['graph+vector'],
        description: 'Combines vector indexing and graph connections for contextually enhanced semantic search.',
      },
      {
        mode: chatModeLables.fulltext,
        description: 'Conducts fast, keyword-based search using full-text indexing on text chunks.',
      },
      {
        mode: chatModeLables['graph+vector+fulltext'],
        description: 'Integrates vector, graph, and full-text indexing for comprehensive search results.',
      },
      {
        mode: chatModeLables['entity search+vector'],
        description: 'Uses vector indexing on entity nodes for highly relevant entity-based search.',
      },
      {
        mode: chatModeLables['global search+vector+fulltext'],
        description:
          'Use vector and full-text indexing on community nodes to provide accurate, context-aware answers globally.',
      },
    ];

export const chunkSize = import.meta.env.VITE_CHUNK_SIZE ? Number(import.meta.env.VITE_CHUNK_SIZE) : 1 * 1024 * 1024;
export const tokenchunkSize = import.meta.env.VITE_TOKENS_PER_CHUNK
  ? Number(import.meta.env.VITE_TOKENS_PER_CHUNK)
  : 100;
export const chunkOverlap = import.meta.env.VITE_CHUNK_OVERLAP ? Number(import.meta.env.VITE_CHUNK_OVERLAP) : 20;
export const chunksToCombine = import.meta.env.VITE_CHUNK_TO_COMBINE
  ? Number(import.meta.env.VITE_CHUNK_TO_COMBINE)
  : 1;
export const defaultTokenChunkSizeOptions = [50, 100, 200, 400, 1000];
export const defaultChunkOverlapOptions = [10, 20, 30, 40, 50];
export const defaultChunksToCombineOptions = [1, 2, 3, 4, 5, 6];

export interface EmbeddingModelOption {
  provider: string;
  model: string;
  dimension: number;
  label: string;
  value: string;
}

export const embeddingModels: EmbeddingModelOption[] = [
  {
    provider: 'openai',
    model: 'text-embedding-3-large',
    dimension: 3072,
    label: 'OpenAI text-embedding-3-large',
    value: 'openai-text-embedding-3-large',
  },
  {
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimension: 1536,
    label: 'OpenAI text-embedding-3-small',
    value: 'openai-text-embedding-3-small',
  },
  {
    provider: 'openai',
    model: 'text-embedding-ada-002',
    dimension: 1536,
    label: 'OpenAI text-embedding-ada-002',
    value: 'openai-text-embedding-ada-002',
  },
  {
    provider: 'gemini',
    model: 'gemini-embedding-001',
    dimension: 3072,
    label: 'Gemini gemini-embedding-001',
    value: 'gemini-gemini-embedding-001',
  },
  {
    provider: 'gemini',
    model: 'text-embedding-005',
    dimension: 768,
    label: 'Gemini text-embedding-005',
    value: 'gemini-text-embedding-005',
  },
  {
    provider: 'titan',
    model: 'amazon.titan-embed-text-v2:0',
    dimension: 1024,
    label: 'Titan amazon.titan-embed-text-v2:0',
    value: 'titan-amazon.titan-embed-text-v2:0',
  },
  {
    provider: 'titan',
    model: 'amazon.titan-embed-text-v1',
    dimension: 1536,
    label: 'Titan amazon.titan-embed-text-v1',
    value: 'titan-amazon.titan-embed-text-v1',
  },
  {
    provider: 'sentence-transformer',
    model: 'all-MiniLM-L6-v2',
    dimension: 384,
    label: 'Sentence Transformer all-MiniLM-L6-v2',
    value: 'sentence-transformer-all-MiniLM-L6-v2',
  },
];
export const DEFAULT_EMBEDDING_MODEL: EmbeddingModelOption = {
  provider: 'sentence-transformer',
  model: 'all-MiniLM-L6-v2',
  dimension: 384,
  label: 'Sentence Transformer all-MiniLM-L6-v2',
  value: 'sentence-transformer-all-MiniLM-L6-v2',
};

export const timeperpage = import.meta.env.VITE_TIME_PER_PAGE ? Number(import.meta.env.VITE_TIME_PER_PAGE) : 50;
export const timePerByte = 0.2;
export const largeFileSize = import.meta.env.VITE_LARGE_FILE_SIZE
  ? Number(import.meta.env.VITE_LARGE_FILE_SIZE)
  : 5 * 1024 * 1024;

export const tooltips = i18nDict('tooltips', [
  'generateGraph',
  'deleteFile',
  'showGraph',
  'bloomGraph',
  'deleteSelectedFiles',
  'previewGraphSelectedFiles',
  'documentation',
  'github',
  'theme',
  'settings',
  'chat',
  'sources',
  'deleteChat',
  'maximise',
  'copy',
  'copied',
  'stopSpeaking',
  'textTospeech',
  'createSchema',
  'useExistingSchema',
  'clearChat',
  'continue',
  'clearGraphSettings',
  'applySettings',
  'openChatPopout',
  'downloadChat',
  'visualizeGraph',
  'additionalInstructions',
  'predinedSchema',
  'dataImporterJson',
] as const);
export const PRODMODELS = ['gemini_3.5_flash', 'openai_gpt_5.4_mini', 'diffbot', 'anthropic_claude_4.5_haiku'];
export const modelTooltipMap: Record<string, string> = {
  'gemini_3.5_flash': 'gemini-3.5-flash',
};
export const buttonCaptions = i18nDict('buttonCaptions', [
  'exploreGraphWithBloom',
  'showPreviewGraph',
  'deleteFiles',
  'generateGraph',
  'dropzoneSpan',
  'youtube',
  'gcs',
  'amazon',
  'noLables',
  'dropYourCreds',
  'analyze',
  'connect',
  'disconnect',
  'submit',
  'connectToNeo4j',
  'cancel',
  'details',
  'continueSettings',
  'clearSettings',
  'ask',
  'applyGraphSchema',
  'provideAdditionalInstructions',
  'analyzeInstructions',
  'helpInstructions',
  'importDropzoneSpan',
] as const);

const POST_PROCESSING_JOB_TITLES = [
  'materialize_text_chunk_similarities',
  'enable_hybrid_search_and_fulltext_search_in_bloom',
  'materialize_entity_similarities',
  'enable_communities',
  'graph_schema_consolidation',
] as const;

export const POST_PROCESSING_JOBS: { title: string; description: string }[] = POST_PROCESSING_JOB_TITLES.map(
  (title) => ({
    title,
    get description() {
      return tr(`postProcessing.${title}`);
    },
  })
);
export const RETRY_OPIONS = [
  'start_from_beginning',
  'delete_entities_and_start_from_beginning',
  'start_from_last_processed_position',
];
export const batchSize: number = Number(import.meta.env.VITE_BATCH_SIZE ?? '2');

// Graph Constants
export const document = `+ [docs]`;

export const chunks = `+ collect { MATCH p=(c)-[:NEXT_CHUNK]-() RETURN p } // chunk-chain
+ collect { MATCH p=(c)-[:SIMILAR]-() RETURN p } // similar-chunks`;

export const entities = `+ collect { OPTIONAL MATCH (c:Chunk)-[:HAS_ENTITY]->(e), p=(e)-[*0..1]-(:!Chunk) RETURN p}`;

export const docEntities = `+ [docs] 
+ collect { MATCH (c:Chunk)-[:HAS_ENTITY]->(e), p=(e)--(:!Chunk) RETURN p }`;

export const docChunks = `+[chunks]
+collect {MATCH p=(c)-[:FIRST_CHUNK]-() RETURN p} //first chunk
+ collect { MATCH p=(c)-[:NEXT_CHUNK]-() RETURN p } // chunk-chain
+ collect { MATCH p=(c)-[:SIMILAR]-() RETURN p } // similar-chunk`;

export const chunksEntities = `+ collect { MATCH p=(c)-[:NEXT_CHUNK]-() RETURN p } // chunk-chain

+ collect { MATCH p=(c)-[:SIMILAR]-() RETURN p } // similar-chunks
//chunks with entities
+ collect { OPTIONAL MATCH p=(c:Chunk)-[:HAS_ENTITY]->(e)-[*0..1]-(:!Chunk) RETURN p }`;

export const docChunkEntities = `+[chunks]
+collect {MATCH p=(c)-[:FIRST_CHUNK]-() RETURN p} //first chunk
+ collect { MATCH p=(c)-[:NEXT_CHUNK]-() RETURN p } // chunk-chain
+ collect { MATCH p=(c)-[:SIMILAR]-() RETURN p } // similar-chunks
//chunks with entities
+ collect { OPTIONAL MATCH p=(c:Chunk)-[:HAS_ENTITY]->(e)-[*0..1]-(:!Chunk) RETURN p }`;

export const nvlOptions: NvlOptions = {
  allowDynamicMinZoom: true,
  disableWebGL: true,
  maxZoom: 3,
  minZoom: 0.05,
  relationshipThreshold: 0.55,
  useWebGL: false,
  instanceId: 'graph-preview',
  initialZoom: 1,
};

export const queryMap: {
  Document: string;
  Chunks: string;
  Entities: string;
  DocEntities: string;
  DocChunks: string;
  ChunksEntities: string;
  DocChunkEntities: string;
} = {
  Document: 'document',
  Chunks: 'chunks',
  Entities: 'entities',
  DocEntities: 'docEntities',
  DocChunks: 'docChunks',
  ChunksEntities: 'chunksEntities',
  DocChunkEntities: 'docChunkEntities',
};

// export const graphQuery: string = queryMap.DocChunkEntities;
export const graphView: OptionType[] = [
  { label: 'Lexical Graph', value: queryMap.DocChunks },
  { label: 'Entity Graph', value: queryMap.Entities },
  { label: 'Knowledge Graph', value: queryMap.DocChunkEntities },
];

export const intitalGraphType = (isGDSActive: boolean): GraphType[] => {
  return isGDSActive
    ? ['DocumentChunk', 'Entities', 'Communities'] // GDS is active, include communities
    : ['DocumentChunk', 'Entities']; // GDS is inactive, exclude communities
};

export const graphLabels = {
  showGraphView: 'showGraphView',
  chatInfoView: 'chatInfoView',
  get generateGraph() {
    return tr('graphLabels.generateGraph');
  },
  get inspectGeneratedGraphFrom() {
    return tr('graphLabels.inspectGeneratedGraphFrom');
  },
  get document() {
    return tr('graphLabels.document');
  },
  get chunk() {
    return tr('graphLabels.chunk');
  },
  documentChunk: 'DocumentChunk',
  get entities() {
    return tr('graphLabels.entities');
  },
  get resultOverview() {
    return tr('graphLabels.resultOverview');
  },
  get totalNodes() {
    return tr('graphLabels.totalNodes');
  },
  get noEntities() {
    return tr('graphLabels.noEntities');
  },
  get selectCheckbox() {
    return tr('graphLabels.selectCheckbox');
  },
  get totalRelationships() {
    return tr('graphLabels.totalRelationships');
  },
  nodeSize: 30,
  get docChunk() {
    return tr('graphLabels.docChunk');
  },
  get community() {
    return tr('graphLabels.community');
  },
  get noNodesRels() {
    return tr('graphLabels.noNodesRels');
  },
  neighborView: 'neighborView',
  get chunksInfo() {
    return tr('graphLabels.chunksInfo');
  },
  showSchemaView: 'showSchemaView',
  get renderSchemaGraph() {
    return tr('graphLabels.renderSchemaGraph');
  },
  get generatedGraphFromUserSchema() {
    return tr('graphLabels.generatedGraphFromUserSchema');
  },
};

export const RESULT_STEP_SIZE = 25;

export const connectionLabels = {
  get notConnected() {
    return tr('connectionLabels.notConnected');
  },
  get graphDataScience() {
    return tr('connectionLabels.graphDataScience');
  },
  get graphDatabase() {
    return tr('connectionLabels.graphDatabase');
  },
  greenStroke: 'green',
  redStroke: 'red',
};

export const getDefaultMessage = () => {
  return [{ ...chatbotmessages.listMessages[0], datetime: getDateTime() }];
};

export const appLabels = i18nDict('appLabels', [
  'ownSchema',
  'predefinedSchema',
  'chunkingConfiguration',
  'graphPatternTuple',
  'selectedPatterns',
  'dataImporterSchema',
] as const);

export const LLMDropdownLabel = i18nDict('llmDropdown', ['disabledModels', 'devEnv'] as const);
export const getDefaultSchemaExamples = () => {
  return schemaExamples.map((example) => ({
    label: example.schema,
    value: JSON.stringify(example.triplet),
  }));
};

export function mergeNestedObjects(objects: Record<string, Record<string, number>>[]) {
  return objects.reduce((merged, obj) => {
    for (const key in obj) {
      if (!merged[key]) {
        merged[key] = {};
      }
      for (const innerKey in obj[key]) {
        merged[key][innerKey] = obj[key][innerKey];
      }
    }
    return merged;
  }, {});
}
export function getStoredSchema() {
  const storedSchemas = localStorage.getItem('selectedSchemas');
  if (storedSchemas) {
    const parsedSchemas = JSON.parse(storedSchemas);
    return parsedSchemas.selectedOptions;
  }
  return [];
}
export const metricsinfo: Record<string, string> = i18nDict('metrics', [
  'faithfulness',
  'answer_relevancy',
  'rouge_score',
  'semantic_score',
  'context_entity_recall',
] as const);
export const EXPIRATION_DAYS = 3;
export const SKIP_AUTH = (import.meta.env.VITE_SKIP_AUTH ?? 'true') == 'true';

export const sourceOptions: PatternOption[] = [{ label: 'Person', value: 'Person' }];
export const typeOptions: PatternOption[] = [{ label: 'WORKS_FOR', value: 'WORKS_FOR' }];
export const targetOptions: PatternOption[] = [{ label: 'Company', value: 'Company' }];

export const LOCAL_KEYS = {
  source: 'customSourceOptions',
  type: 'customTypeOptions',
  target: 'customTargetOptions',
};

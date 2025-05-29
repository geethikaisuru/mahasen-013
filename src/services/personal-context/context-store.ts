import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  writeBatch,
  serverTimestamp,
  type DocumentReference,
  type CollectionReference
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  PersonalContextProfile,
  PersonalContextDocument,
  ContactRelationshipDocument,
  CommunicationPatternDocument,
  LearningProgressDocument,
  ContactRelationship,
  ContactCommunicationStyle,
  LearningProgress
} from '@/types/personal-context';

export class PersonalContextStore {
  private static instance: PersonalContextStore;
  
  private constructor() {}
  
  public static getInstance(): PersonalContextStore {
    if (!PersonalContextStore.instance) {
      PersonalContextStore.instance = new PersonalContextStore();
    }
    return PersonalContextStore.instance;
  }

  // Personal Context Profile Operations
  async savePersonalContext(userId: string, profile: PersonalContextProfile): Promise<void> {
    try {
      const docRef = doc(db, 'personal_contexts', userId);
      const contextDoc: Omit<PersonalContextDocument, 'id'> = {
        userId,
        profile,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(docRef, {
        ...contextDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log(`[PersonalContextStore] Saved personal context for user: ${userId}`);
    } catch (error) {
      console.error(`[PersonalContextStore] Error saving personal context for user ${userId}:`, error);
      throw new Error(`Failed to save personal context: ${(error as Error).message}`);
    }
  }

  async getPersonalContext(userId: string): Promise<PersonalContextProfile | null> {
    try {
      const docRef = doc(db, 'personal_contexts', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as PersonalContextDocument;
        console.log(`[PersonalContextStore] Retrieved personal context for user: ${userId}`);
        return data.profile;
      } else {
        console.log(`[PersonalContextStore] No personal context found for user: ${userId}`);
        return null;
      }
    } catch (error) {
      console.error(`[PersonalContextStore] Error retrieving personal context for user ${userId}:`, error);
      throw new Error(`Failed to retrieve personal context: ${(error as Error).message}`);
    }
  }

  async updatePersonalContext(userId: string, updates: Partial<PersonalContextProfile>): Promise<void> {
    try {
      const docRef = doc(db, 'personal_contexts', userId);
      await updateDoc(docRef, {
        profile: updates,
        updatedAt: serverTimestamp()
      });
      
      console.log(`[PersonalContextStore] Updated personal context for user: ${userId}`);
    } catch (error) {
      console.error(`[PersonalContextStore] Error updating personal context for user ${userId}:`, error);
      throw new Error(`Failed to update personal context: ${(error as Error).message}`);
    }
  }

  // Contact Relationship Operations
  async saveContactRelationship(userId: string, contactEmail: string, relationship: ContactRelationship): Promise<void> {
    try {
      const docId = `${userId}_${contactEmail.replace(/[.#$[\]]/g, '_')}`;
      const docRef = doc(db, 'contact_relationships', docId);
      
      const relationshipDoc: Omit<ContactRelationshipDocument, 'id'> = {
        userId,
        contactEmail,
        relationship,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(docRef, {
        ...relationshipDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log(`[PersonalContextStore] Saved contact relationship for ${contactEmail}`);
    } catch (error) {
      console.error(`[PersonalContextStore] Error saving contact relationship:`, error);
      throw new Error(`Failed to save contact relationship: ${(error as Error).message}`);
    }
  }

  async getContactRelationships(userId: string): Promise<ContactRelationship[]> {
    try {
      const relationshipsRef = collection(db, 'contact_relationships');
      const q = query(relationshipsRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const relationships: ContactRelationship[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as ContactRelationshipDocument;
        relationships.push(data.relationship);
      });
      
      console.log(`[PersonalContextStore] Retrieved ${relationships.length} contact relationships for user: ${userId}`);
      return relationships;
    } catch (error) {
      console.error(`[PersonalContextStore] Error retrieving contact relationships:`, error);
      throw new Error(`Failed to retrieve contact relationships: ${(error as Error).message}`);
    }
  }

  async getContactRelationship(userId: string, contactEmail: string): Promise<ContactRelationship | null> {
    try {
      const docId = `${userId}_${contactEmail.replace(/[.#$[\]]/g, '_')}`;
      const docRef = doc(db, 'contact_relationships', docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as ContactRelationshipDocument;
        return data.relationship;
      }
      return null;
    } catch (error) {
      console.error(`[PersonalContextStore] Error retrieving contact relationship:`, error);
      throw new Error(`Failed to retrieve contact relationship: ${(error as Error).message}`);
    }
  }

  // Communication Pattern Operations
  async saveCommunicationPattern(userId: string, contactEmail: string, pattern: ContactCommunicationStyle): Promise<void> {
    try {
      const docId = `${userId}_${contactEmail.replace(/[.#$[\]]/g, '_')}`;
      const docRef = doc(db, 'communication_patterns', docId);
      
      const patternDoc: Omit<CommunicationPatternDocument, 'id'> = {
        userId,
        contactEmail,
        pattern,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(docRef, {
        ...patternDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log(`[PersonalContextStore] Saved communication pattern for ${contactEmail}`);
    } catch (error) {
      console.error(`[PersonalContextStore] Error saving communication pattern:`, error);
      throw new Error(`Failed to save communication pattern: ${(error as Error).message}`);
    }
  }

  async getCommunicationPatterns(userId: string): Promise<ContactCommunicationStyle[]> {
    try {
      const patternsRef = collection(db, 'communication_patterns');
      const q = query(patternsRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const patterns: ContactCommunicationStyle[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as CommunicationPatternDocument;
        patterns.push(data.pattern);
      });
      
      console.log(`[PersonalContextStore] Retrieved ${patterns.length} communication patterns for user: ${userId}`);
      return patterns;
    } catch (error) {
      console.error(`[PersonalContextStore] Error retrieving communication patterns:`, error);
      throw new Error(`Failed to retrieve communication patterns: ${(error as Error).message}`);
    }
  }

  // Learning Progress Operations
  async saveLearningProgress(userId: string, progress: LearningProgress): Promise<void> {
    try {
      const docRef = doc(db, 'learning_progress', userId);
      const progressDoc: Omit<LearningProgressDocument, 'id'> = {
        userId,
        progress,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(docRef, {
        ...progressDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log(`[PersonalContextStore] Saved learning progress for user: ${userId}`);
    } catch (error) {
      console.error(`[PersonalContextStore] Error saving learning progress:`, error);
      throw new Error(`Failed to save learning progress: ${(error as Error).message}`);
    }
  }

  async getLearningProgress(userId: string): Promise<LearningProgress | null> {
    try {
      const docRef = doc(db, 'learning_progress', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as LearningProgressDocument;
        return data.progress;
      }
      return null;
    } catch (error) {
      console.error(`[PersonalContextStore] Error retrieving learning progress:`, error);
      throw new Error(`Failed to retrieve learning progress: ${(error as Error).message}`);
    }
  }

  async updateLearningProgress(userId: string, updates: Partial<LearningProgress>): Promise<void> {
    try {
      const docRef = doc(db, 'learning_progress', userId);
      await updateDoc(docRef, {
        progress: updates,
        updatedAt: serverTimestamp()
      });
      
      console.log(`[PersonalContextStore] Updated learning progress for user: ${userId}`);
    } catch (error) {
      console.error(`[PersonalContextStore] Error updating learning progress:`, error);
      throw new Error(`Failed to update learning progress: ${(error as Error).message}`);
    }
  }

  // Batch Operations for Efficiency
  async saveBatchContactRelationships(userId: string, relationships: Array<{ contactEmail: string; relationship: ContactRelationship }>): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      for (const { contactEmail, relationship } of relationships) {
        const docId = `${userId}_${contactEmail.replace(/[.#$[\]]/g, '_')}`;
        const docRef = doc(db, 'contact_relationships', docId);
        
        const relationshipDoc = {
          userId,
          contactEmail,
          relationship,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        batch.set(docRef, relationshipDoc);
      }
      
      await batch.commit();
      console.log(`[PersonalContextStore] Batch saved ${relationships.length} contact relationships`);
    } catch (error) {
      console.error(`[PersonalContextStore] Error batch saving contact relationships:`, error);
      throw new Error(`Failed to batch save contact relationships: ${(error as Error).message}`);
    }
  }

  async saveBatchCommunicationPatterns(userId: string, patterns: Array<{ contactEmail: string; pattern: ContactCommunicationStyle }>): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      for (const { contactEmail, pattern } of patterns) {
        const docId = `${userId}_${contactEmail.replace(/[.#$[\]]/g, '_')}`;
        const docRef = doc(db, 'communication_patterns', docId);
        
        const patternDoc = {
          userId,
          contactEmail,
          pattern,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        batch.set(docRef, patternDoc);
      }
      
      await batch.commit();
      console.log(`[PersonalContextStore] Batch saved ${patterns.length} communication patterns`);
    } catch (error) {
      console.error(`[PersonalContextStore] Error batch saving communication patterns:`, error);
      throw new Error(`Failed to batch save communication patterns: ${(error as Error).message}`);
    }
  }

  // Cleanup Operations
  async deletePersonalContextData(userId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      // Delete personal context
      const contextRef = doc(db, 'personal_contexts', userId);
      batch.delete(contextRef);
      
      // Delete learning progress
      const progressRef = doc(db, 'learning_progress', userId);
      batch.delete(progressRef);
      
      // Delete contact relationships
      const relationshipsRef = collection(db, 'contact_relationships');
      const relationshipsQuery = query(relationshipsRef, where('userId', '==', userId));
      const relationshipsSnapshot = await getDocs(relationshipsQuery);
      relationshipsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // Delete communication patterns
      const patternsRef = collection(db, 'communication_patterns');
      const patternsQuery = query(patternsRef, where('userId', '==', userId));
      const patternsSnapshot = await getDocs(patternsQuery);
      patternsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`[PersonalContextStore] Deleted all personal context data for user: ${userId}`);
    } catch (error) {
      console.error(`[PersonalContextStore] Error deleting personal context data:`, error);
      throw new Error(`Failed to delete personal context data: ${(error as Error).message}`);
    }
  }

  // Utility Methods
  async getUserStatistics(userId: string): Promise<{
    hasPersonalContext: boolean;
    contactCount: number;
    patternCount: number;
    lastUpdated?: Date;
    confidence?: number;
  }> {
    try {
      const [personalContext, relationships, patterns] = await Promise.all([
        this.getPersonalContext(userId),
        this.getContactRelationships(userId),
        this.getCommunicationPatterns(userId)
      ]);
      
      return {
        hasPersonalContext: !!personalContext,
        contactCount: relationships.length,
        patternCount: patterns.length,
        lastUpdated: personalContext?.lastUpdated,
        confidence: personalContext?.confidence
      };
    } catch (error) {
      console.error(`[PersonalContextStore] Error getting user statistics:`, error);
      throw new Error(`Failed to get user statistics: ${(error as Error).message}`);
    }
  }
}

// Export singleton instance
export const personalContextStore = PersonalContextStore.getInstance(); 